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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(
    SUPABASE_URL,
    SERVICE_KEY,
    { auth: { persistSession: false } },
  );
}

async function logChat(entry: {
  user_id?: string | null;
  event_type: string;
  source?: string | null;
  model?: string | null;
  duration_ms?: number | null;
  success?: boolean | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await admin().from("chat_logs").insert(entry);
  } catch (e) {
    console.error("chat log insert failed", e);
  }
}

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
      const { field, profile, workflow, context } = payload ?? {};
      let system: string;
      let user: string;
      if (context === "admin_workflow_description") {
        system = `You help a University of Fort Hare ADMINISTRATOR write a clear, professional description for an opportunity/workflow that prospective applicants will read. Write in third person/imperative, 3-5 sentences. Cover: purpose of the opportunity, who it is for, key requirements, and expected outcomes. Formal, descriptive, no first-person, no markdown.`;
        user = `Workflow name: ${workflow?.name ?? ""}\nExisting description (may be empty): ${workflow?.description ?? ""}\nField label: ${field?.label ?? "Workflow description"}`;
      } else {
        system = `You are an in-form writing copilot for a South African university opportunity application. Write in first person, formal but warm, 2-4 sentences. Use the applicant's actual profile facts when relevant. Do not invent qualifications. Output plain text only — no markdown.`;
        user = `Field label: ${field?.label}\nField help: ${field?.help_text ?? ""}\nOpportunity: ${workflow?.name ?? ""} — ${workflow?.description ?? ""}\nApplicant profile JSON: ${JSON.stringify(profile ?? {})}`;
      }
      const llm = await callLLM(system, user);
      const text = llm ?? ruleSuggest(field ?? { label: "this field" }, profile ?? {});
      return Response.json({ text, source: llm ? "ai" : "rules" }, { headers: corsHeaders });
    }

    if (action === "explain_eligibility") {
      const { workflow, profile, eligible, reasons } = payload ?? {};
      const system = `You explain UFH opportunity eligibility decisions to a student or staff member clearly and kindly in 2-4 sentences. Consider the applicant's qualification (highest_qualification_completed, current_qualification), year_of_study, and that a postgraduate is anyone who has completed a Bachelors or is currently pursuing Honours/Masters/Doctorate. If not eligible, suggest what would change the outcome. Plain text only.`;
      const user = `Decision: ${eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}\nReasons: ${JSON.stringify(reasons ?? [])}\nOpportunity: ${JSON.stringify(workflow ?? {})}\nApplicant: ${JSON.stringify(profile ?? {})}`;
      const llm = await callLLM(system, user);
      const text = llm ?? ruleEligibilityExplain({ workflow, eligible, reasons });
      return Response.json({ text, source: llm ? "ai" : "rules" }, { headers: corsHeaders });
    }

    if (action === "rewrite") {
      const { field, profile, workflow, current, context } = payload ?? {};
      const system = context === "admin_workflow_description"
        ? `You polish and rewrite an ADMINISTRATOR's draft description of a UFH opportunity for prospective applicants. Keep the meaning. Improve clarity, structure, and professional tone. 3-5 sentences, third person. Plain text only.`
        : `You polish and rewrite an applicant's draft answer for a South African university opportunity application. Keep their meaning and facts. Improve clarity, tone (formal but warm), flow and grammar. First person. 2-4 sentences. Plain text only.`;
      const user = `Field label: ${field?.label}\nField help: ${field?.help_text ?? ""}\nOpportunity: ${workflow?.name ?? ""} — ${workflow?.description ?? ""}\nApplicant profile JSON: ${JSON.stringify(profile ?? {})}\nDraft to rewrite:\n${current ?? ""}`;
      const llm = await callLLM(system, user);
      const text = llm ?? (current && String(current).trim().length > 0
        ? String(current).trim()
        : ruleSuggest(field ?? { label: "this field" }, profile ?? {}));
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

    if (action === "chat") {
      const { messages, role, page, profile, userId, context } = payload ?? {};
      const contextBlock = context
        ? `\n\nCURRENT CONTEXT (use this to give accurate, specific answers about what the user is looking at):\n${JSON.stringify(context).slice(0, 2000)}`
        : "";
      const system = `You are the UFH Opportunity Assistant for the University of Fort Hare (UFH) Opportunity Hub platform.

Your job: help ${role === "admin" ? "an administrator" : "a student/staff user"} use this platform and find UFH resources.

Be accurate, concise (2-5 sentences), professional and friendly. Never invent features that don't exist. If unsure, tell the user where they can look (dashboard, profile, admin panel, UFH website).

Platform capabilities you know about:
- Dashboard (/dashboard): browse opportunities, see your applications, unread messages.
- Opportunities: internal workflows (apply in-platform) and external opportunities (open link on UFH/partner sites). Each has eligibility rules based on qualification, year of study, faculty, department.
- Applications (/apply/:slug): fill fields with AI assistant, upload documents, submit. Users can withdraw only while status is 'submitted'.
- Profile (/profile): personal info, qualification, year of study, banking, next of kin.
- Messages (/messages): conversations with reviewers.
- Settings (/settings): theme.
- Admin (/admin): manage workflows, review applications, extract opportunities from Daily Bulletin PDFs, manage admins, audit logs.

Useful UFH links you can share when relevant:
- UFH main site: https://www.ufh.ac.za
- UFH Student Portal (ITS/iEnabler): https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login
- UFH Blackboard: https://ufh.blackboard.com
- UFH Library: https://libguides.ufh.ac.za
- UFH Financial Aid: https://www.ufh.ac.za/students/financial-aid
- UFH Contact: +27 40 602 2011

Current user context: role=${role ?? "student"}, page=${page ?? "unknown"}${profile?.faculty ? `, faculty=${profile.faculty}` : ""}${profile?.department ? `, dept=${profile.department}` : ""}.${contextBlock}

When suggesting an action the user can take in this app, end your message with a JSON line on its own last line like:
ACTIONS: [{"label":"View Opportunities","route":"/dashboard"},{"label":"Open UFH ITS","url":"https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login"}]
Only include ACTIONS when helpful. Max 3 actions. No markdown formatting anywhere else.`;
      const convo = Array.isArray(messages) ? messages.slice(-12) : [];
      const key = Deno.env.get("LOVABLE_API_KEY");
      let text: string | null = null;
      const started = Date.now();
      if (key) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          const res = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "Authorization": `Bearer ${key}` },
            body: JSON.stringify({
              model: MODEL,
              messages: [{ role: "system", content: system }, ...convo],
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            text = data?.choices?.[0]?.message?.content?.trim() ?? null;
            await logChat({ user_id: userId ?? null, event_type: "chat", source: "ai", model: MODEL, duration_ms: Date.now() - started, success: !!text, metadata: { page, hasContext: !!context } });
          } else {
            const errBody = await res.text();
            console.error("chat gateway error", res.status, errBody);
            await logChat({ user_id: userId ?? null, event_type: "chat", source: "ai", model: MODEL, duration_ms: Date.now() - started, success: false, error_message: `gateway ${res.status}: ${errBody.slice(0,500)}`, metadata: { page } });
          }
        } catch (e: any) {
          console.error("chat exception", e);
          await logChat({ user_id: userId ?? null, event_type: "chat", source: "ai", model: MODEL, duration_ms: Date.now() - started, success: false, error_message: e?.name === "AbortError" ? "timeout" : (e?.message ?? String(e)), metadata: { page } });
        }
      } else {
        await logChat({ user_id: userId ?? null, event_type: "chat", source: "ai", success: false, error_message: "missing LOVABLE_API_KEY", metadata: { page } });
      }
      return Response.json({ text, source: text ? "ai" : null }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("ai-assist error", e);
    return Response.json({ error: e?.message ?? "Internal error" }, { status: 500, headers: corsHeaders });
  }
});
