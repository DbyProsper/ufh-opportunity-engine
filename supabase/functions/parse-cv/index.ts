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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Edge function requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY, and SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY");
    }
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
            date_of_birth: { type: "string", description: "ISO date YYYY-MM-DD if found" },
            gender: { type: "string" },
            id_number: { type: "string", description: "South African ID or passport number" },
            nationality: { type: "string" },
            home_language: { type: "string" },
            race: { type: "string", description: "One of: Black African, Coloured, Indian/Asian, White, Other, Prefer not to say" },
            disability: { type: "string" },
            student_number: { type: "string" },
            staff_number: { type: "string" },
            address: { type: "string" },
            home_address: {
              type: "object",
              properties: {
                line1: { type: "string" }, line2: { type: "string" },
                city: { type: "string" }, province: { type: "string" },
                postal_code: { type: "string" }, country: { type: "string" },
              },
            },
            next_of_kin: {
              type: "object",
              properties: {
                full_name: { type: "string" }, relationship: { type: "string" },
                phone: { type: "string" }, email: { type: "string" }, address: { type: "string" },
              },
            },
            employment: {
              type: "object",
              properties: {
                employer: { type: "string" }, position: { type: "string" },
                start_date: { type: "string" }, end_date: { type: "string" }, is_current: { type: "boolean" },
              },
            },
            banking: {
              type: "object",
              properties: {
                bank_name: { type: "string" }, branch_code: { type: "string" },
                account_number: { type: "string" }, account_type: { type: "string" }, account_holder: { type: "string" },
              },
            },
            financial: {
              type: "object",
              properties: {
                sars_tax_number: { type: "string" }, income_tax_ref: { type: "string" },
                vat_number: { type: "string" }, marital_status: { type: "string" }, dependants: { type: "number" },
              },
            },
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
Leave fields blank only if truly absent. Always return cv_text containing full plain-text of the CV.
IMPORTANT: Extract ALL information present, not just personal details. Specifically look for and populate:
 - home_address (line1/city/province/postal_code/country)
 - next_of_kin (full_name, relationship, phone, email, address)
 - employment (most recent role: employer, position, start_date, end_date, is_current)
 - banking (bank_name, account_number, branch_code, account_type, account_holder)
 - financial (sars_tax_number, marital_status, dependants)
 - identity (id_number, date_of_birth, gender, nationality, home_language)
For race, choose the closest of: Black African, Coloured, Indian/Asian, White, Other, Prefer not to say. If not stated, leave blank.`,
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
    const fillable = [
      "full_name", "email", "phone", "student_number", "staff_number", "address",
      "faculty", "department", "qualification", "year_of_study", "bio",
      "date_of_birth", "gender", "id_number", "nationality", "home_language", "race", "disability",
    ] as const;
    for (const k of fillable) {
      const v = extracted[k];
      if (v && (!existing?.[k] || String(existing[k]).trim() === "")) update[k] = v;
    }
    // department depends on faculty being valid
    if (update.department && !update.faculty && !existing?.faculty) delete update.department;

    await admin.from("profiles").update(update).eq("id", user.id);

    // Also populate related tables when AI returned structured info, without overwriting non-empty rows.
    const counts: Record<string, number> = {};

    if (extracted.home_address && Object.values(extracted.home_address).some((x: any) => x && String(x).trim())) {
      const { data: existingAddr } = await admin.from("addresses").select("id").eq("user_id", user.id).eq("kind", "home").maybeSingle();
      if (!existingAddr) {
        await admin.from("addresses").insert({
          user_id: user.id, kind: "home", is_primary: true,
          line1: extracted.home_address.line1 ?? null,
          line2: extracted.home_address.line2 ?? null,
          city: extracted.home_address.city ?? null,
          province: extracted.home_address.province ?? null,
          postal_code: extracted.home_address.postal_code ?? null,
          country: extracted.home_address.country ?? "South Africa",
        });
        counts.address = 1;
      }
    }

    if (extracted.next_of_kin && (extracted.next_of_kin.full_name || extracted.next_of_kin.phone)) {
      const { data: existingNok } = await admin.from("next_of_kin").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingNok) {
        await admin.from("next_of_kin").insert({
          user_id: user.id, is_primary: true,
          full_name: extracted.next_of_kin.full_name ?? null,
          relationship: extracted.next_of_kin.relationship ?? null,
          phone: extracted.next_of_kin.phone ?? null,
          email: extracted.next_of_kin.email ?? null,
          address: extracted.next_of_kin.address ?? null,
        });
        counts.next_of_kin = 1;
      }
    }

    if (extracted.employment && (extracted.employment.employer || extracted.employment.position)) {
      const { data: existingEmp } = await admin.from("employment_details").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!existingEmp) {
        await admin.from("employment_details").insert({
          user_id: user.id,
          employer: extracted.employment.employer ?? null,
          position: extracted.employment.position ?? null,
          start_date: extracted.employment.start_date || null,
          end_date: extracted.employment.end_date || null,
          is_current: !!extracted.employment.is_current,
        });
        counts.employment = 1;
      }
    }

    if (extracted.banking && (extracted.banking.bank_name || extracted.banking.account_number)) {
      const { data: existingBank } = await admin.from("banking_details").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!existingBank) {
        await admin.from("banking_details").insert({
          user_id: user.id, is_primary: true,
          bank_name: extracted.banking.bank_name ?? null,
          branch_code: extracted.banking.branch_code ?? null,
          account_number: extracted.banking.account_number ?? null,
          account_type: extracted.banking.account_type ?? null,
          account_holder: extracted.banking.account_holder ?? null,
        });
        counts.banking = 1;
      }
    }

    if (extracted.financial && (extracted.financial.sars_tax_number || extracted.financial.marital_status)) {
      await admin.from("financial_profile").upsert({
        user_id: user.id,
        sars_tax_number: extracted.financial.sars_tax_number ?? null,
        income_tax_ref: extracted.financial.income_tax_ref ?? null,
        vat_number: extracted.financial.vat_number ?? null,
        marital_status: extracted.financial.marital_status ?? null,
        dependants: extracted.financial.dependants ?? null,
      }, { onConflict: "user_id" });
      counts.financial = 1;
    }

    return new Response(JSON.stringify({ ok: true, applied: update, related: counts, raw: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});