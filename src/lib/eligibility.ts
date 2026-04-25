import type { Tables } from "@/integrations/supabase/types";

type Profile = Partial<Tables<"profiles">>;
type Workflow = Tables<"workflows">;
type Rule = Tables<"eligibility_rules">;

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * checkEligibility(user, workflow)
 * Evaluates target_role, department, faculty rules + extra eligibility_rules.
 */
export function checkEligibility(
  profile: Profile | null,
  roles: string[],
  workflow: Workflow,
  rules: Rule[] = []
): EligibilityResult {
  const reasons: string[] = [];

  if (!profile) {
    return { eligible: false, reasons: ["Complete your profile to check eligibility"] };
  }

  if (workflow.target_role !== "any") {
    if (!roles.includes(workflow.target_role)) {
      reasons.push(`Restricted to ${workflow.target_role}s`);
    }
  }

  if (workflow.department && profile.department) {
    if (workflow.department.toLowerCase() !== profile.department.toLowerCase()) {
      reasons.push(`Only for ${workflow.department} department`);
    }
  }

  if (workflow.faculty && profile.faculty) {
    if (workflow.faculty.toLowerCase() !== profile.faculty.toLowerCase()) {
      reasons.push(`Only for Faculty of ${workflow.faculty}`);
    }
  }

  for (const r of rules) {
    const val = (profile as any)?.[r.rule_type];
    if (val && String(val).toLowerCase() !== r.rule_value.toLowerCase()) {
      reasons.push(`${r.rule_type}: ${r.rule_value} required`);
    }
  }

  if (workflow.deadline && new Date(workflow.deadline) < new Date()) {
    reasons.push("Application deadline has passed");
  }

  if (!workflow.is_active) {
    reasons.push("Not currently accepting applications");
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Future AI hook - placeholder.
 */
export function rankApplicants(applications: any[]): any[] {
  // TODO: wire up to Lovable AI for ranking by criteria
  return [...applications].sort((a, b) => {
    const aScore = a.completion_score ?? 0;
    const bScore = b.completion_score ?? 0;
    return bScore - aScore;
  });
}