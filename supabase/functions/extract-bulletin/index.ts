// Daily Bulletin extraction. Accepts a PDF (base64) and returns structured
// opportunities classified as internal (build a workflow) or external (link card).
// Uses the Lovable AI gateway with PDF vision. Falls back to rule-based parsing
// of OCR text when AI is unavailable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const TOOL = {
  type: "function",
  function: {
    name: "extract_opportunities",
    description: "Extract every distinct opportunity, vacancy, or call for applications from the bulletin.",
    parameters: {
      type: "object",
      properties: {
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              organization: { type: "string", description: "Department, faculty, or external organisation" },
              description: { type: "string", description: "1-3 sentence summary of what the opportunity is" },
              requirements: { type: "string", description: "Eligibility / requirements text if present" },
              deadline: { type: "string", description: "ISO 8601 date if a deadline is mentioned, else empty" },
              external_link: { type: "string", description: "Full URL if the bulletin says apply via a link" },
              type: { type: "string", enum: ["internal", "external"], description: "external if there is an apply URL or 'apply here/click here' phrase, otherwise internal" },
              confidence: { type: "number", description: "0-1 confidence this is a real, actionable opportunity" },
              eligibility_hints: {
                type: "array",
                description: "Inferred eligibility rules from the requirements text. Use rule_type from the allowed set.",
                items: {
                  type: "object",
                  properties: {
                    rule_type: { type: "string", enum: ["is_postgraduate", "requires_qualification_completed", "requires_current_qualification", "min_year_of_study", "has_student_number", "has_staff_number", "faculty", "department"] },
                    rule_value: { type: "string" }
                  },
                  required: ["rule_type", "rule_value"]
                }
              }
            },
            required: ["title", "type", "confidence"],
          },
        },
      },
      required: ["opportunities"],
    },
  },
};

const SYSTEM = `You read the University of Fort Hare daily bulletin PDF and extract every distinct opportunity, vacancy, scholarship, bursary, or call for applications.
Rules:
- Treat phrases like "Applications are invited", "Vacancy", "Opportunity", "Call for applications", "Bursary", "Scholarship" as section markers.
- If an opportunity has an apply URL or says "apply here", "click here", "visit", "submit at <url>", set type = "external" and capture external_link.
- Otherwise set type = "internal".
- Set confidence between 0 and 1. Be conservative (<0.5) for vague mentions and >0.8 for clearly described opportunities with title + requirements.
- Never invent opportunities. If the document has none, return an empty array.
- Extract eligibility_hints when the requirements text mentions any of:
  • postgraduate / honours / masters / doctoral → { rule_type: "is_postgraduate", rule_value: "true" }
  • completed Bachelors/Honours required → { rule_type: "requires_qualification_completed", rule_value: "Bachelors" | "Honours" | ... }
  • currently pursuing X → { rule_type: "requires_current_qualification", rule_value: "Honours" | "Masters" | ... }
  • year 2/3/4 of study required → { rule_type: "min_year_of_study", rule_value: "2" | "3" | "4" }
  • must be a registered student → { rule_type: "has_student_number", rule_value: "true" }
  • staff only / staff number → { rule_type: "has_staff_number", rule_value: "true" }
  • specific faculty/department → { rule_type: "faculty" | "department", rule_value: "<name>" }
  Only emit hints clearly supported by the text. Otherwise return an empty list.`;

function ruleBasedExtract(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const markers = /(applications? (?:are )?invited|vacancy|opportunity|call for applications?|bursary|scholarship)/i;
  const urlRe = /(https?:\/\/[^\s)]+)/i;
  const externalRe = /(apply here|click here|apply via|submit at)/i;
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (markers.test(l) && cur.length) { blocks.push(cur.join("\n")); cur = []; }
    cur.push(l);
  }
  if (cur.length) blocks.push(cur.join("\n"));
  return blocks
    .filter((b) => markers.test(b))
    .map((b) => {
      const title = (b.split("\n").find((l) => l.length > 10 && l.length < 140) || b.slice(0, 80)).trim();
      const link = b.match(urlRe)?.[1] ?? "";
      const isExternal = !!link || externalRe.test(b);
      const dl = b.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i)?.[1] ?? "";
      return {
        title,
        organization: "",
        description: b.slice(0, 400),
        requirements: "",
        deadline: dl ? new Date(dl).toISOString() : "",
        external_link: link,
        type: isExternal ? "external" : "internal",
        confidence: 0.55,
      };
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON) {
      return json({ error: "Edge function requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY, and SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY" }, 500);
    }
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const { pdfBase64, mime, fallbackText, fileName, fileHash } = await req.json().catch(() => ({}));
    if (!pdfBase64 && !fallbackText) return json({ error: "Provide pdfBase64 or fallbackText" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    let opportunities: any[] = [];

    if (key && pdfBase64) {
      try {
        const res = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract every opportunity in this bulletin PDF." },
                  { type: "image_url", image_url: { url: `data:${mime || "application/pdf"};base64,${pdfBase64}` } },
                ],
              },
            ],
            tools: [TOOL],
            tool_choice: { type: "function", function: { name: "extract_opportunities" } },
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const call = j.choices?.[0]?.message?.tool_calls?.[0];
          if (call?.function?.arguments) {
            const parsed = JSON.parse(call.function.arguments);
            opportunities = parsed.opportunities ?? [];
          }
        } else {
          console.error("Gateway error", res.status, await res.text());
        }
      } catch (e) {
        console.error("AI extraction failed:", e);
      }
    }

    if (opportunities.length === 0 && fallbackText) {
      opportunities = ruleBasedExtract(String(fallbackText));
    }

    // Normalise + dedupe by title
    const seen = new Set<string>();
    opportunities = opportunities
      .filter((o) => o?.title && !seen.has(o.title.toLowerCase()) && (seen.add(o.title.toLowerCase()), true))
      .map((o) => ({
        title: String(o.title).slice(0, 200),
        organization: String(o.organization ?? "").slice(0, 200),
        description: String(o.description ?? "").slice(0, 2000),
        requirements: String(o.requirements ?? "").slice(0, 2000),
        deadline: o.deadline || null,
        external_link: String(o.external_link ?? ""),
        type: o.type === "external" || o.external_link ? "external" : "internal",
        confidence: typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.6,
        eligibility_hints: Array.isArray(o.eligibility_hints) ? o.eligibility_hints : [],
      }));

    // Log this run for audit
    let runId: string | null = null;
    try {
      const { data: runRow } = await admin.from("bulletin_runs").insert({
        uploaded_by: user.id,
        uploader_email: user.email ?? null,
        file_name: String(fileName ?? "bulletin.pdf").slice(0, 255),
        file_hash: String(fileHash ?? "unknown").slice(0, 128),
        opportunities,
        drafts_created: [],
        source: key && pdfBase64 ? "ai" : "rules",
      }).select("id").single();
      runId = (runRow as any)?.id ?? null;
    } catch (e) { console.error("bulletin_runs insert failed", e); }

    return json({ ok: true, opportunities, run_id: runId, source: opportunities.length && key ? "ai" : "rules" });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}