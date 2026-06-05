import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Partial<Tables<"profiles">>;
type Workflow = Tables<"workflows">;

// Small in-memory cache so we don't re-call the gateway for identical inputs.
const cache = new Map<string, any>();
const key = (parts: any[]) => JSON.stringify(parts);

export interface SuggestionResult {
  text: string;
  source: "ai" | "rules";
}

export async function generateSuggestion(
  field: { id?: string; label: string; help_text?: string; type?: string },
  profile: Profile | null,
  workflow?: { name: string; description?: string | null } | null,
  opts: { regenerate?: boolean; context?: string } = {}
): Promise<SuggestionResult> {
  const k = key(["suggest", field.label, profile?.id, workflow?.name, opts.context ?? "", opts.regenerate ? Date.now() : 0]);
  if (!opts.regenerate && cache.has(k)) return cache.get(k);
  try {
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: { action: "suggest", payload: { field, profile, workflow, context: opts.context } },
    });
    if (error) throw error;
    const result = { text: (data as any).text, source: (data as any).source } as SuggestionResult;
    cache.set(k, result);
    return result;
  } catch (e) {
    console.error("generateSuggestion failed, falling back", e);
    return { text: localSuggestion(field, profile), source: "rules" };
  }
}

export async function rewriteSuggestion(
  field: { id?: string; label: string; help_text?: string; type?: string },
  current: string,
  profile: Profile | null,
  workflow?: { name: string; description?: string | null } | null,
  context?: string,
): Promise<SuggestionResult> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: { action: "rewrite", payload: { field, profile, workflow, current, context } },
    });
    if (error) throw error;
    return { text: (data as any).text, source: (data as any).source } as SuggestionResult;
  } catch (e) {
    console.error("rewriteSuggestion failed", e);
    return { text: current?.trim() || localSuggestion(field, profile), source: "rules" };
  }
}

function localSuggestion(field: { label: string }, profile: Profile | null): string {
  const dept = profile?.department || "your discipline";
  const qual = profile?.qualification || "your programme";
  return `Drafted response for "${field.label}": Drawing on ${qual} in ${dept}, describe relevant experience and your motivation for this opportunity.`;
}

// ────────────────────────────────────────────────────────────────────
// Eligibility scoring + explainer
// ────────────────────────────────────────────────────────────────────

export interface EligibilityScored {
  eligible: boolean;
  score: number;
  reasons: string[];
  positive: string[];
}

export function scoreEligibility(
  profile: Profile | null,
  roles: string[],
  workflow: Workflow,
  rules: Tables<"eligibility_rules">[] = []
): EligibilityScored {
  const reasons: string[] = [];
  const positive: string[] = [];
  let score = 0;

  if (!profile) {
    return { eligible: false, score: 0, reasons: ["Complete your profile to check eligibility"], positive: [] };
  }

  // Role match
  if (workflow.target_role === "any") {
    score += 25;
    positive.push("Open to any role");
  } else if (roles.includes(workflow.target_role)) {
    score += 25;
    positive.push(`You are registered as a ${workflow.target_role}`);
  } else {
    reasons.push(`Restricted to ${workflow.target_role}s`);
  }

  // Department
  if (workflow.department && profile.department) {
    if (workflow.department.toLowerCase() === profile.department.toLowerCase()) {
      score += 25;
      positive.push(`Department matches (${profile.department})`);
    } else {
      reasons.push(`Only for ${workflow.department} department`);
    }
  } else if (!workflow.department) {
    score += 10;
  }

  // Faculty
  if (workflow.faculty && profile.faculty) {
    if (workflow.faculty.toLowerCase() === profile.faculty.toLowerCase()) {
      score += 20;
      positive.push(`Faculty matches (${profile.faculty})`);
    } else {
      reasons.push(`Only for Faculty of ${workflow.faculty}`);
    }
  } else if (!workflow.faculty) {
    score += 10;
  }

  // Custom eligibility rules
  for (const r of rules) {
    const val = (profile as any)?.[r.rule_type];
    if (val && String(val).toLowerCase() === r.rule_value.toLowerCase()) {
      score += 10;
      positive.push(`${r.rule_type}: ${r.rule_value} ✓`);
    } else if (val) {
      reasons.push(`${r.rule_type}: ${r.rule_value} required`);
    }
  }

  if (workflow.deadline && new Date(workflow.deadline) < new Date()) {
    reasons.push("Application deadline has passed");
  }
  if (!workflow.is_active) reasons.push("Not currently accepting applications");

  const eligible = reasons.length === 0;
  return { eligible, score: Math.min(100, score), reasons, positive };
}

export async function explainEligibility(
  workflow: Workflow,
  profile: Profile | null,
  scored: EligibilityScored
): Promise<string> {
  const k = key(["explain", workflow.id, profile?.id, scored.eligible, scored.reasons.join("|")]);
  if (cache.has(k)) return cache.get(k);
  try {
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: {
        action: "explain_eligibility",
        payload: { workflow, profile, eligible: scored.eligible, reasons: scored.reasons.concat(scored.positive.map((p) => `Strength: ${p}`)) },
      },
    });
    if (error) throw error;
    const txt = (data as any).text as string;
    cache.set(k, txt);
    return txt;
  } catch (e) {
    console.error("explainEligibility fallback", e);
    if (scored.eligible) {
      return `You're eligible for "${workflow.name}".\n\n${scored.positive.map((p) => `• ${p}`).join("\n")}`;
    }
    return `You're not currently eligible for "${workflow.name}".\n\n${scored.reasons.map((r) => `• ${r}`).join("\n")}\n\nYou may qualify in the future if these requirements change.`;
  }
}

// ────────────────────────────────────────────────────────────────────
// Application ranking (admin)
// ────────────────────────────────────────────────────────────────────

export interface RankedApplication {
  id: string;
  score: number;
  rank: number;
  reasons: string[];
}

/**
 * Rule-based scoring:
 *   profile completeness  +20
 *   matching department   +20
 *   matching faculty      +15
 *   all required docs     +20
 *   status progress       +10
 *   submitted on time     +10
 *   has CV on file        +5
 */
export function rankApplications(input: {
  applications: any[];
  profiles: any[];
  workflows: any[];
  uploadedDocs: Record<string, string[]>; // app_id -> document_id[]
  requiredDocs: Record<string, string[]>; // workflow_id -> document_id[]
}): RankedApplication[] {
  const { applications, profiles, workflows, uploadedDocs, requiredDocs } = input;

  const scored = applications.map((a) => {
    const prof = profiles.find((p) => p.id === a.user_id) || {};
    const wf = workflows.find((w) => w.id === a.workflow_id) || {};
    const reasons: string[] = [];
    let score = 0;

    const profileFields = ["full_name", "phone", "id_number", "faculty", "department", "qualification"];
    const filled = profileFields.filter((f) => !!(prof as any)[f]).length;
    const completeness = Math.round((filled / profileFields.length) * 20);
    score += completeness;
    reasons.push(`Profile completeness: ${Math.round((filled / profileFields.length) * 100)}% (+${completeness})`);

    if (wf.department && prof.department && wf.department.toLowerCase() === prof.department.toLowerCase()) {
      score += 20;
      reasons.push(`Department match: ${prof.department} (+20)`);
    }
    if (wf.faculty && prof.faculty && wf.faculty.toLowerCase() === prof.faculty.toLowerCase()) {
      score += 15;
      reasons.push(`Faculty match: ${prof.faculty} (+15)`);
    }

    const need = requiredDocs[a.workflow_id] ?? [];
    const have = new Set(uploadedDocs[a.id] ?? []);
    if (need.length === 0) {
      score += 10;
      reasons.push("No required documents (+10)");
    } else {
      const got = need.filter((d) => have.has(d)).length;
      const docScore = Math.round((got / need.length) * 20);
      score += docScore;
      reasons.push(`Documents: ${got}/${need.length} uploaded (+${docScore})`);
    }

    if (a.status === "approved") { score += 10; reasons.push("Already approved (+10)"); }
    else if (a.status === "under_review" || a.status === "submitted") { score += 6; reasons.push("Submitted for review (+6)"); }

    if (a.submitted_at && wf.deadline && new Date(a.submitted_at) <= new Date(wf.deadline)) {
      score += 10; reasons.push("Submitted before deadline (+10)");
    }

    if (prof.cv_path) { score += 5; reasons.push("CV on file (+5)"); }

    return { id: a.id, score: Math.min(100, score), rank: 0, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}
