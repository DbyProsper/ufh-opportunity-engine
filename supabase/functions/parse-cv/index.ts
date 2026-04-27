// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UFH_FACULTIES: Record<string, string[]> = {
  "Faculty of Education": ["Teacher Education", "Curriculum Studies", "Educational Psychology"],
  "Faculty of Health Sciences": ["Nursing Science", "Public Health", "Human Movement Science"],
  "Faculty of Law (Nelson R. Mandela School of Law)": ["Public Law", "Private Law", "Criminal & Procedural Law"],
  "Faculty of Management & Commerce": ["Accounting", "Economics", "Business Management", "Public Administration", "Information Systems", "Industrial Psychology"],
  "Faculty of Science & Agriculture": ["Computer Science", "Mathematics", "Statistics", "Physics", "Chemistry", "Botany", "Zoology", "Agricultural Economics", "Agronomy", "Biochemistry & Microbiology"],
  "Faculty of Social Sciences & Humanities": ["Languages & Communication", "Politics & Philosophy", "Psychology, Social Work & Criminology", "Sociology & Anthropology", "Visual & Performing Arts", "Liberation Studies"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { cvPath } = await req.json().catch(() => ({}));
    if (!cvPath || typeof cvPath !== "string" || !cvPath.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "Invalid cvPath" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const dl = await admin.storage.from("user-cvs").download(cvPath);
    if (dl.error || !dl.data) {
      return new Response(JSON.stringify({ error: "Could not read CV" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Convert to base64 for the model
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);
    const mime = dl.data.type || "application/pdf";

    const facultiesList = Object.keys(UFH_FACULTIES).join(" | ");
    const deptList = Object.entries(UFH_FACULTIES).map(([f, ds]) => `${f}: ${ds.join(", ")}`).join("\n");

    const tools = [{
      type: "function",
      function: {
        name: "extract_cv",
        description: "Extract structured profile information from a CV.",
        parameters: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            student_number: { type: "string" },
            staff_number: { type: "string" },
            address: { type: "string" },
            faculty: { type: "string", enum: Object.keys(UFH_FACULTIES), description: "Closest matching UFH faculty" },
            department: { type: "string", description: "Closest matching department within the chosen faculty" },
            qualification: { type: "string", description: "Current/highest qualification or programme" },
            year_of_study: { type: "string" },
            bio: { type: "string", description: "2-4 sentence professional summary covering experience, skills, achievements" },
            cv_text: { type: "string", description: "Full plain-text content extracted from the CV (preserve order, omit binary noise)" },
          },
          required: ["cv_text"],
          additionalProperties: false,
        },
      },
    }];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You extract structured profile data from CVs for University of Fort Hare (UFH) students and staff.
Map faculty/department to the closest official UFH option.
Available faculties: ${facultiesList}
Departments by faculty:
${deptList}
Leave fields blank only if truly absent. Always return cv_text containing full plain-text of the CV.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract profile information from this CV." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_cv" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway", aiRes.status, t);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI extraction failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let extracted: any = {};
    try { extracted = JSON.parse(call?.function?.arguments ?? "{}"); } catch { extracted = {}; }

    // Validate faculty/department against UFH list
    if (extracted.faculty && !UFH_FACULTIES[extracted.faculty]) extracted.faculty = null;
    if (extracted.faculty && extracted.department) {
      const allowed = UFH_FACULTIES[extracted.faculty];
      if (!allowed.includes(extracted.department)) {
        // try fuzzy: case-insensitive contains
        const match = allowed.find((d) => d.toLowerCase() === String(extracted.department).toLowerCase());
        extracted.department = match ?? null;
      }
    } else if (!extracted.faculty) {
      extracted.department = null;
    }

    // Persist: only fill fields that were missing from the existing profile (don't overwrite user input)
    const { data: existing } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const update: Record<string, any> = {
      cv_path: cvPath,
      cv_uploaded_at: new Date().toISOString(),
      cv_text: extracted.cv_text ?? null,
    };
    const fillable = ["full_name", "email", "phone", "student_number", "staff_number", "address", "faculty", "department", "qualification", "year_of_study", "bio"] as const;
    for (const k of fillable) {
      const v = extracted[k];
      if (v && (!existing?.[k] || String(existing[k]).trim() === "")) update[k] = v;
    }
    // department depends on faculty being valid
    if (update.department && !update.faculty && !existing?.faculty) delete update.department;

    await admin.from("profiles").update(update).eq("id", user.id);

    return new Response(JSON.stringify({ ok: true, applied: update, raw: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});