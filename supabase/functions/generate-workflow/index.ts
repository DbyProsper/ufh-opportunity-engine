// AI workflow generator. Takes an admin prompt + optional structured overrides
// and returns a JSON workflow spec via tool-calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You design application workflows for a South African university opportunity hub (UFH).
Every workflow you create MUST start with these COMMON FIELDS unless explicitly told otherwise:
- Personal: full_name, email, phone (auto-fill from profile)
- Identity: id_number, date_of_birth, gender, nationality
- Academic/Employment: faculty, department, qualification, year_of_study (or staff_number for staff)
- Address: line1, city, province, postal_code (auto-fill via address.line1, etc.)

Add 1-3 EXTRA STEPS specific to the request (e.g. motivation, references, financial need).
Pick required documents that match the purpose. Always include any standard docs (CV, ID copy, proof of registration).
Be concise. Slugs are kebab-case.`;

const TOOL = {
  type: "function",
  function: {
    name: "create_workflow",
    description: "Produce a complete workflow specification.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string", description: "kebab-case unique identifier" },
        description: { type: "string" },
        target_role: { type: "string", enum: ["student", "staff", "any"] },
        faculty: { type: "string" },
        department: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    type: { type: "string", enum: ["text","textarea","select","date","file","number","email","phone"] },
                    required: { type: "boolean" },
                    placeholder: { type: "string" },
                    help_text: { type: "string" },
                    profile_field: { type: "string", description: "e.g. full_name, email, address.line1, bank.account_number" },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["label","type"],
                },
              },
            },
            required: ["title","fields"],
          },
        },
        documents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              required: { type: "boolean" },
              description: { type: "string" },
            },
            required: ["name"],
          },
        },
        eligibility: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule_type: { type: "string", description: "profile field, e.g. faculty, department, year_of_study" },
              rule_value: { type: "string" },
            },
            required: ["rule_type","rule_value"],
          },
        },
      },
      required: ["name","slug","description","target_role","steps","documents"],
    },
  },
} as const;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    const user = ud?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const prompt: string = (body?.prompt ?? "").toString();
    const overrides = body?.overrides ?? {};
    if (!prompt.trim()) {
      return new Response(JSON.stringify({ error: "prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userMessage = `Admin request:\n${prompt}\n\nOptional overrides:\n${JSON.stringify(overrides)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "create_workflow" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}: ${text}` }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI did not return a workflow");
    const spec = JSON.parse(call.function.arguments);

    // Persist workflow
    let slug = slugify(spec.slug || spec.name);
    // ensure unique
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await admin.from("workflows").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const { data: wf, error: wfErr } = await admin.from("workflows").insert({
      name: spec.name,
      slug,
      description: spec.description ?? null,
      target_role: ["student","staff","any"].includes(spec.target_role) ? spec.target_role : "student",
      faculty: spec.faculty ?? null,
      department: spec.department ?? null,
      created_by: user.id,
      is_active: false,
    }).select().single();
    if (wfErr) throw wfErr;

    // Steps + fields
    const steps = spec.steps ?? [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const { data: stepRow, error: sErr } = await admin.from("workflow_steps").insert({
        workflow_id: wf.id,
        title: s.title,
        description: s.description ?? null,
        step_order: i,
      }).select().single();
      if (sErr) throw sErr;
      const fields = (s.fields ?? []) as any[];
      if (fields.length) {
        const rows = fields.map((f, fi) => ({
          workflow_id: wf.id,
          step_id: stepRow.id,
          label: f.label,
          field_key: slugify(f.label) + "_" + fi,
          type: f.type ?? "text",
          required: !!f.required,
          placeholder: f.placeholder ?? null,
          help_text: f.help_text ?? null,
          profile_field: f.profile_field ?? null,
          options: f.options && f.options.length ? f.options : null,
          field_order: fi,
        }));
        const { error: fErr } = await admin.from("workflow_fields").insert(rows);
        if (fErr) throw fErr;
      }
    }

    // Documents
    const docs = (spec.documents ?? []) as any[];
    if (docs.length) {
      const rows = docs.map((d, i) => ({
        workflow_id: wf.id,
        name: d.name,
        description: d.description ?? null,
        required: d.required !== false,
        doc_order: i,
      }));
      await admin.from("workflow_documents").insert(rows);
    }

    // Eligibility
    const rules = (spec.eligibility ?? []) as any[];
    if (rules.length) {
      const rows = rules.map((r) => ({
        workflow_id: wf.id,
        rule_type: r.rule_type,
        rule_value: String(r.rule_value),
      }));
      await admin.from("eligibility_rules").insert(rows);
    }

    return new Response(JSON.stringify({ workflow: wf, slug, summary: spec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});