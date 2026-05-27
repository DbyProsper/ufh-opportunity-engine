// AI assist edge function. Handles three actions used by the UFH Opportunity Hub:
//   - suggest: in-form copilot suggestions for a single field
//   - explain_eligibility: human-readable eligibility explanation
//   - rank: rank a set of applicants with scores + reasons
//
// Uses the Lovable AI Gateway when LOVABLE_API_KEY is available; otherwise
// returns intelligent rule-based output so the UI always has a real answer.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callLLM(system: string, user: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    console.error("AI gateway exception", e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule-based fallback for field suggestion
// ────────────────────────────────────────────────────────────────────
function ruleSuggest(field: { label: string; help_text?: string; type?: string }, profile: any): string {
  const label = (field.label || "").toLowerCase();
  const dept = profile?.department || "your discipline";
  const fac = profile?.faculty || "your faculty";
  const qual = profile?.qualification || "your current programme";
  const year = profile?.year_of_study || "your current year";
  const name = profile?.full_name?.split(" ")?.[0] || "I";

  if (/motivat|why|interest/.test(label)) {
    return `I am pursuing ${qual} in ${dept} (${fac}) and this opportunity directly supports my academic and career goals. I would bring strong commitment, time-management and a willingness to learn from feedback.`;
  }
  if (/experience|tutor|teach|mentor/.test(label)) {
    return `During my studies in ${dept} I have assisted peers with core modules and study groups, which built my ability to break down complex topics clearly and patiently. This experience prepared me well for ${field.label.toLowerCase()}.`;
  }
  if (/achievement|award|accomplish/.test(label)) {
    return `In ${year} of ${qual}, I have maintained consistent academic performance in ${dept}, contributed to group projects, and taken initiative in department activities.`;
  }
  if (/research|project/.test(label)) {
    return `My current focus in ${dept} aligns with practical, applied work. I am comfortable with literature review, structured problem-solving and presenting findings clearly.`;
  }
  if (/career|goal|plan/.test(label)) {
    return `My short-term goal is to complete ${qual} with distinction. Longer term, I plan to build a career in ${dept}, contributing both technical and leadership skills.`;
  }
  if (/skill|strength/.test(label)) {
    return `Core strengths: analytical thinking from ${dept} coursework, written and verbal communication, teamwork, and a track record of meeting deadlines.`;
  }
  if (/reference/.test(label)) {
    return `Please contact my lecturer or supervisor in the Department of ${dept} who can speak to my academic conduct and engagement.`;
  }
  return `Drafted answer for "${field.label}": ${name} would describe relevant background from ${qual} in ${dept}, supporting evidence, and how this matches the opportunity.`;
}

function ruleEligibilityExplain(input: any): string {
  const { eligible, reasons, workflow } = input;
  if (eligible) {
    return `You are eligible for "${workflow?.name ?? "this opportunity"}". Your profile (department${workflow?.department ? `: ${workflow.department}` : ""}${workflow?.faculty ? `, faculty: ${workflow.faculty}` : ""}) matches the requirements. Submit your application before the deadline to be considered.`;
  }
  const lines = (reasons ?? []).map((r: string) => `• ${r}`).join("\n");
  return `You are not currently eligible for "${workflow?.name ?? "this opportunity"}". Here is why:\n${lines}\n\nYou may qualify in the future if these requirements change or once your profile is updated.`;
}

// ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, payload } = await req.json();

    if (action === "suggest") {
      const { field, profile, workflow } = payload ?? {};
      const system = `You are an in-form writing copilot for a South African university opportunity application. Write in first person, formal but warm, 2-4 sentences. Use the applicant's actual profile facts when relevant. Do not invent qualifications. Output plain text only — no markdown.`;
      const user = `Field label: ${field?.label}\nField help: ${field?.help_text ?? ""}\nOpportunity: ${workflow?.name ?? ""} — ${workflow?.description ?? ""}\nApplicant profile JSON: ${JSON.stringify(profile ?? {})}`;
      const llm = await callLLM(system, user);
      const text = llm ?? ruleSuggest(field ?? { label: "this field" }, profile ?? {});
      return Response.json({ text, source: llm ? "ai" : "rules" }, { headers: corsHeaders });
    }

    if (action === "explain_eligibility") {
      const { workflow, profile, eligible, reasons } = payload ?? {};
      const system = `You explain eligibility decisions clearly and kindly in 2-4 sentences. If not eligible, suggest what would change the outcome. Plain text only.`;
      const user = `Decision: ${eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}\nReasons: ${JSON.stringify(reasons ?? [])}\nOpportunity: ${JSON.stringify(workflow ?? {})}\nApplicant: ${JSON.stringify(profile ?? {})}`;
      const llm = await callLLM(system, user);
      const text = llm ?? ruleEligibilityExplain({ workflow, eligible, reasons });
      return Response.json({ text, source: llm ? "ai" : "rules" }, { headers: corsHeaders });
    }

    if (action === "rank") {
      // Lightweight LLM commentary for the top candidate; main scoring is done client-side.
      const { applications } = payload ?? {};
      const system = `You are an admissions assistant. Produce a short 1-2 sentence ranking rationale for each applicant. Plain JSON only with shape: {"comments":[{"id":"...","comment":"..."}]}`;
      const user = `Applicants (already scored): ${JSON.stringify((applications ?? []).slice(0, 10))}`;
      const llm = await callLLM(system, user);
      let comments: any[] = [];
      if (llm) {
        try {
          const cleaned = llm.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          comments = parsed?.comments ?? [];
        } catch { /* ignore */ }
      }
      return Response.json({ comments, source: llm ? "ai" : "rules" }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("ai-assist error", e);
    return Response.json({ error: e?.message ?? "Internal error" }, { status: 500, headers: corsHeaders });
  }
});
