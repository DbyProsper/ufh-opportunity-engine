import type { Tables } from "@/integrations/supabase/types";

type Profile = Partial<Tables<"profiles">>;
type Workflow = Tables<"workflows">;
type Rule = Tables<"eligibility_rules">;

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  positive?: string[];
}

/**
 * Supported eligibility rule types (rule_type column):
 *   - has_student_number       (rule_value ignored)
 *   - has_staff_number         (rule_value ignored)
 *   - is_postgraduate          (rule_value: "true" | "false")
 *   - requires_qualification_completed  (rule_value: e.g. "Bachelors", "Honours")
 *   - requires_current_qualification    (rule_value: e.g. "Honours", "Masters")
 *   - min_year_of_study        (rule_value: 1..4 or "Honours"/"Masters"/"Doctorate")
 *   - faculty                  (rule_value: faculty name) — legacy
 *   - department               (rule_value: department name) — legacy
 */
export const RULE_TYPES = [
  "has_student_number",
  "has_staff_number",
  "is_postgraduate",
  "requires_qualification_completed",
  "requires_current_qualification",
  "min_year_of_study",
  "faculty",
  "department",
] as const;

export const RULE_TYPE_LABELS: Record<string, string> = {
  has_student_number: "Must have a student number",
  has_staff_number: "Must have a staff number",
  is_postgraduate: "Must be a postgraduate",
  requires_qualification_completed: "Must have completed qualification",
  requires_current_qualification: "Must currently be pursuing qualification",
  min_year_of_study: "Minimum year of study",
  faculty: "Required faculty",
  department: "Required department",
};

export const YEAR_OF_STUDY_OPTIONS = ["1", "2", "3", "4", "Honours", "Masters", "Doctorate", "Professor"];
export const QUALIFICATION_LEVELS = ["Matric", "Certificate", "Diploma", "Bachelors", "Honours", "Masters", "Doctorate"];

// Numeric ranking for year-of-study comparisons. Higher = further along.
const YOS_RANK: Record<string, number> = {
  "1": 1, "2": 2, "3": 3, "4": 4,
  Honours: 5, Masters: 6, Doctorate: 7, Professor: 8,
};
const yos = (v?: string | null) => YOS_RANK[(v ?? "").trim()] ?? 0;

export function isPostgraduate(profile: Profile | null): boolean {
  if (!profile) return false;
  const completed = (profile as any).highest_qualification_completed?.toLowerCase?.() ?? "";
  const current = (profile as any).current_qualification?.toLowerCase?.() ?? (profile.qualification ?? "").toLowerCase();
  const year = (profile.year_of_study ?? "").toLowerCase();
  if (["bachelors", "honours", "masters", "doctorate"].some((q) => completed.includes(q))) return true;
  if (["honours", "masters", "doctorate"].some((q) => current.includes(q))) return true;
  if (["honours", "masters", "doctorate"].includes(year)) return true;
  return false;
}

/**
 * checkEligibility — evaluates built-in checks + a richer set of profile-based rules.
 * Returns reasons (blocking) and positive matches.
 */
export function checkEligibility(
  profile: Profile | null,
  roles: string[],
  workflow: Workflow,
  rules: Rule[] = []
): EligibilityResult {
  const reasons: string[] = [];
  const positive: string[] = [];

  if (!profile) {
    return { eligible: false, reasons: ["Complete your profile to check eligibility"], positive: [] };
  }

  if (workflow.target_role !== "any") {
    if (!roles.includes(workflow.target_role)) {
      reasons.push(`Restricted to ${workflow.target_role}s`);
    } else {
      positive.push(`You are registered as a ${workflow.target_role}`);
    }
  }

  if (workflow.department && profile.department) {
    if (workflow.department.toLowerCase() === profile.department.toLowerCase()) {
      positive.push(`Department matches (${profile.department})`);
    } else {
      reasons.push(`Only for ${workflow.department} department`);
    }
  } else if (workflow.department && !profile.department) {
    reasons.push(`Only for ${workflow.department} department — set your department in your profile`);
  }

  if (workflow.faculty && profile.faculty) {
    if (workflow.faculty.toLowerCase() === profile.faculty.toLowerCase()) {
      positive.push(`Faculty matches (${profile.faculty})`);
    } else {
      reasons.push(`Only for Faculty of ${workflow.faculty}`);
    }
  } else if (workflow.faculty && !profile.faculty) {
    reasons.push(`Only for Faculty of ${workflow.faculty} — set your faculty in your profile`);
  }

  for (const r of rules) {
    const t = r.rule_type;
    const v = (r.rule_value ?? "").trim();

    if (t === "has_student_number") {
      if (profile.student_number?.trim()) positive.push("You have a student number");
      else reasons.push("You must have a student number recorded in your profile");
      continue;
    }
    if (t === "has_staff_number") {
      if (profile.staff_number?.trim()) positive.push("You have a staff number");
      else reasons.push("You must have a staff number recorded in your profile");
      continue;
    }
    if (t === "is_postgraduate") {
      const want = v.toLowerCase() !== "false";
      const have = isPostgraduate(profile);
      if (have === want) positive.push(want ? "You qualify as a postgraduate" : "Open to undergraduates");
      else reasons.push(want ? "Restricted to postgraduate students" : "Restricted to undergraduate students");
      continue;
    }
    if (t === "requires_qualification_completed") {
      const have = (profile as any).highest_qualification_completed ?? "";
      if (yos(have) >= yos(v) || have.toLowerCase().includes(v.toLowerCase())) {
        positive.push(`You have completed ${v}`);
      } else {
        reasons.push(`Requires completed ${v} (your highest completed: ${have || "not set"})`);
      }
      continue;
    }
    if (t === "requires_current_qualification") {
      const cur = ((profile as any).current_qualification ?? profile.qualification ?? "").toLowerCase();
      if (cur.includes(v.toLowerCase())) positive.push(`Currently pursuing ${v}`);
      else reasons.push(`Must currently be pursuing ${v}`);
      continue;
    }
    if (t === "min_year_of_study") {
      const have = yos(profile.year_of_study);
      const need = yos(v);
      if (have >= need && need > 0) positive.push(`At/above year ${v}`);
      else reasons.push(`Requires at least year ${v} (you are: ${profile.year_of_study || "not set"})`);
      continue;
    }
    if (t === "faculty") {
      if (profile.faculty?.toLowerCase() === v.toLowerCase()) positive.push(`Faculty matches (${v})`);
      else reasons.push(`Restricted to Faculty of ${v}`);
      continue;
    }
    if (t === "department") {
      if (profile.department?.toLowerCase() === v.toLowerCase()) positive.push(`Department matches (${v})`);
      else reasons.push(`Restricted to ${v} department`);
      continue;
    }
    // Legacy / unknown — fall back to direct profile field comparison.
    const val = (profile as any)?.[t];
    if (val && v && String(val).toLowerCase() !== v.toLowerCase()) {
      reasons.push(`${t}: ${v} required`);
    }
  }

  if (workflow.deadline && new Date(workflow.deadline) < new Date()) {
    reasons.push("Application deadline has passed");
  }

  if (!workflow.is_active) {
    reasons.push("Not currently accepting applications");
  }

  return { eligible: reasons.length === 0, reasons, positive };
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