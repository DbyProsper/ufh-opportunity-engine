// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates pixel-faithful UFH PDFs.
 *  - kind = "personal_info" : Tutor Personal Information Form (1 page)
 *  - kind = "affidavit_blank": Pre-filled affidavit for download/print
 *  - kind = "acceptance"     : Student Tutor Acceptance of Post Form
 *
 * Input: { applicationId, kind }
 * Output: { url, path } — short-lived signed URL in 'application-packs'
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { applicationId, kind } = await req.json().catch(() => ({}));
    if (!applicationId || !kind) return json({ error: "applicationId and kind required" }, 400);

    const admin = createClient(url, service);
    const { data: app } = await admin.from("applications").select("*").eq("id", applicationId).maybeSingle();
    if (!app) return json({ error: "Not found" }, 404);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (app.user_id !== user.id && !isAdmin) return json({ error: "Forbidden" }, 403);

    const [{ data: profile }, { data: workflow }, { data: addrs }, { data: noks }, { data: fin }, { data: banks }, { data: emps }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", app.user_id).maybeSingle(),
      admin.from("workflows").select("*").eq("id", app.workflow_id).maybeSingle(),
      admin.from("addresses").select("*").eq("user_id", app.user_id),
      admin.from("next_of_kin").select("*").eq("user_id", app.user_id).limit(1),
      admin.from("financial_profile").select("*").eq("user_id", app.user_id).maybeSingle(),
      admin.from("banking_details").select("*").eq("user_id", app.user_id).limit(1),
      admin.from("employment_details").select("*").eq("user_id", app.user_id).order("is_current", { ascending: false }).limit(1),
    ]);

    const addrHome = (addrs ?? []).find((a: any) => a.kind === "home") ?? (addrs ?? [])[0];
    const addrPost = (addrs ?? []).find((a: any) => a.kind === "postal");
    const nok = (noks ?? [])[0];
    const bank = (banks ?? [])[0];
    const emp = (emps ?? [])[0];

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    let bytes: Uint8Array;
    if (kind === "personal_info") {
      bytes = await renderPersonalInfo(pdf, font, fontBold, { profile, addrHome, addrPost, nok, fin, bank, emp });
    } else if (kind === "affidavit_blank") {
      bytes = await renderAffidavit(pdf, font, fontBold, fontItalic, { profile, workflow });
    } else if (kind === "acceptance") {
      bytes = await renderAcceptance(pdf, font, fontBold, { profile, workflow });
    } else {
      return json({ error: "Unknown kind" }, 400);
    }

    const path = `${applicationId}/${kind}-${Date.now()}.pdf`;
    const up = await admin.storage.from("application-packs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    const signed = await admin.storage.from("application-packs").createSignedUrl(path, 60 * 10);
    if (signed.error) throw signed.error;

    // For affidavit, register/refresh the submission row
    if (kind === "affidavit_blank") {
      const { data: existing } = await admin.from("affidavit_submissions").select("id").eq("application_id", applicationId).maybeSingle();
      if (existing) {
        await admin.from("affidavit_submissions").update({
          status: "generated", generated_path: path, generated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("affidavit_submissions").insert({
          application_id: applicationId, user_id: app.user_id,
          status: "generated", generated_path: path, generated_at: new Date().toISOString(),
        });
      }
    }

    return json({ url: signed.data.signedUrl, path });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ============================================================
// PERSONAL INFO FORM — recreates the UFH layout
// ============================================================
async function renderPersonalInfo(pdf: PDFDocument, f: PDFFont, fb: PDFFont, d: any): Promise<Uint8Array> {
  const page = pdf.addPage([595.28, 841.89]);
  const { profile, addrHome, addrPost, nok, fin, bank, emp } = d;

  drawHeader(page, fb, f, "TUTOR PERSONAL INFORMATION FORM",
    "Submit with copies of ID/Passport, Study Permit, Proof of registration & Bank Stamped statement");

  let y = 745;
  y = section(page, fb, "PERSONAL DETAILS", y);
  y = grid(page, f, fb, [
    ["Employee Number", profile?.staff_number, "Identity Number", profile?.id_number],
    ["Passport Number", "", "Title", profile?.title],
    ["Date of Birth", profile?.date_of_birth, "Initials", initials(profile?.full_name)],
    ["Surname", surname(profile?.full_name), "UFH email address", profile?.email],
    ["Gender", profile?.gender, "Preferred Language", profile?.home_language],
    ["Marital Status", fin?.marital_status, "Disability", profile?.disability],
    ["Work Number", "", "Cell phone Number", profile?.phone],
  ], y);

  y -= 6;
  y = section(page, fb, "ADDRESS 1 (Residential)", y);
  y = grid(page, f, fb, [
    ["Unit Number", addrHome?.line2, "Street", addrHome?.line1],
    ["Suburb", addrHome?.line2, "Postal Code", addrHome?.postal_code],
    ["City", addrHome?.city, "Country", addrHome?.country],
    ["Province", addrHome?.province, "Type", addrHome?.kind],
  ], y);

  y -= 6;
  y = section(page, fb, "ADDRESS 2 (Postal)", y);
  y = grid(page, f, fb, [
    ["Unit Number", addrPost?.line2, "Street", addrPost?.line1],
    ["Suburb", addrPost?.line2, "Postal Code", addrPost?.postal_code],
    ["City", addrPost?.city, "Country", addrPost?.country],
    ["Province", addrPost?.province, "Type", addrPost?.kind],
  ], y);

  y -= 6;
  y = section(page, fb, "NEXT OF KIN", y);
  y = grid(page, f, fb, [
    ["Relationship", nok?.relationship, "Name", nok?.full_name],
    ["Cell phone Number", nok?.phone, "Email", nok?.email],
  ], y);

  y -= 6;
  y = section(page, fb, "SARS", y);
  y = grid(page, f, fb, [
    ["Receiver of Revenue (Town)", fin?.vat_number, "Income Tax Number", fin?.income_tax_ref ?? fin?.sars_tax_number],
  ], y);

  y -= 6;
  y = section(page, fb, "BANKING INFORMATION", y);
  y = grid(page, f, fb, [
    ["Account Holder", bank?.account_holder, "Bank", bank?.bank_name],
    ["Branch Code", bank?.branch_code, "Account Number", bank?.account_number],
    ["Account Type", bank?.account_type, "Is your only employment", emp?.is_current ? "No" : "Yes"],
  ], y);

  y -= 14;
  page.drawText("By affixing my signature below, I confirm that the information provided is true to the best of my knowledge.",
    { x: 40, y, size: 9, font: f, color: rgb(0.15, 0.15, 0.2) });
  y -= 30;
  page.drawLine({ start: { x: 40, y }, end: { x: 280, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 320, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawText("Signature", { x: 40, y: y - 12, size: 8, font: f });
  page.drawText("Date", { x: 320, y: y - 12, size: 8, font: f });

  return await pdf.save();
}

// ============================================================
// AFFIDAVIT — pre-filled, blank signature + commissioner area
// ============================================================
async function renderAffidavit(pdf: PDFDocument, f: PDFFont, fb: PDFFont, fi: PDFFont, d: any): Promise<Uint8Array> {
  const page = pdf.addPage([595.28, 841.89]);
  const { profile, workflow } = d;

  page.drawText("PEOPLE AND CHANGE COMPETENCIES DEPARTMENT (HR)", { x: 40, y: 800, size: 11, font: fb, color: rgb(0.05, 0.15, 0.4) });
  page.drawText("Office of the Director", { x: 40, y: 786, size: 9, font: fi, color: rgb(0.3, 0.3, 0.35) });
  page.drawText("PABX 7365  |  Fax: +27 (86) 6204256", { x: 40, y: 772, size: 8, font: f });
  page.drawLine({ start: { x: 40, y: 762 }, end: { x: 555, y: 762 }, thickness: 0.6, color: rgb(0.1, 0.2, 0.5) });

  page.drawText("STUDENT TUTOR / ASSISTANT ACCEPTANCE OF POST FORM / AFFIDAVIT",
    { x: 40, y: 738, size: 12, font: fb });

  let y = 700;
  const line = (label: string, val: string | null | undefined, len = 320) => {
    page.drawText(label, { x: 40, y, size: 10, font: f });
    const lblW = f.widthOfTextAtSize(label, 10);
    page.drawLine({ start: { x: 50 + lblW, y: y - 2 }, end: { x: 50 + lblW + len, y: y - 2 }, thickness: 0.4, color: rgb(0.4, 0.4, 0.4) });
    if (val) page.drawText(val, { x: 54 + lblW, y, size: 10, font: fb });
    y -= 22;
  };

  line("I,", profile?.full_name, 380);
  line("ID Number:", profile?.id_number, 380);
  line("Study Permit No:", "", 200);

  const intro = "do hereby accept / do not accept (✓ whichever is applicable) the offer and the conditions as stipulated in the offer for the post of:";
  y = wrap(page, f, intro, 40, y, 515, 10, 13);
  y -= 6;
  line("Post:", workflow?.name, 460);
  line("Department:", profile?.department, 380);
  line("Ready to assume duties on:", "", 280);

  y -= 8;
  page.drawText("AFFIDAVIT", { x: 40, y, size: 11, font: fb }); y -= 16;

  const decl = `DECLARATION UNDER OATH: I, ${profile?.full_name ?? "_______________________"}, declare under oath that I will work a maximum of 23 hours per month for the University of Fort Hare, for the duration of my contract. I also fully understand that I shall not have multiple appointments and I will work for one department/faculty. Should I have multiple appointments, none of them will be paid. Should I be appointed within any other department or faculty within UFH, I will notify Human Resources.`;
  y = wrap(page, f, decl, 40, y, 515, 10, 13);
  y -= 6;
  const oath = "I have no objection to taking the prescribed oath and consider it to be binding on my conscience. I understand the contents of this statement, and that I can face disciplinary action if I am in breach of this declaration.";
  y = wrap(page, f, oath, 40, y, 515, 10, 13);
  y -= 6;
  const cert = "I certify that the above statement was taken by me and the deponent has acknowledged that he/she knows and understands the contents of this statement. This statement was sworn to before me and the deponent's signature was placed thereon in my presence at:";
  y = wrap(page, f, cert, 40, y, 515, 10, 13);

  y -= 14;
  line("Place:", "", 220);
  line("Date:", "", 220);
  y -= 30;
  page.drawLine({ start: { x: 40, y }, end: { x: 280, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 320, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawText("Commissioner of Oaths (sign & stamp)", { x: 40, y: y - 12, size: 8, font: f });
  page.drawText("Deponent's signature", { x: 320, y: y - 12, size: 8, font: f });

  page.drawText("Human Resources / 2011", { x: 40, y: 40, size: 8, font: fi, color: rgb(0.4, 0.4, 0.45) });

  return await pdf.save();
}

// ============================================================
// ACCEPTANCE FORM
// ============================================================
async function renderAcceptance(pdf: PDFDocument, f: PDFFont, fb: PDFFont, d: any): Promise<Uint8Array> {
  const page = pdf.addPage([595.28, 841.89]);
  const { profile, workflow } = d;
  drawHeader(page, fb, f, "ACCEPTANCE OF POST", "Tutor / Student Assistant — Acceptance form");

  let y = 745;
  y = section(page, fb, "APPLICANT", y);
  y = grid(page, f, fb, [
    ["Full name", profile?.full_name, "ID Number", profile?.id_number],
    ["UFH email", profile?.email, "Cell phone", profile?.phone],
    ["Faculty", profile?.faculty, "Department", profile?.department],
    ["Post", workflow?.name, "Status", "Acceptance"],
  ], y);

  y -= 10;
  const text =
    "I accept the offer and the conditions stipulated in the offer letter for the above post. I confirm that the information I have provided is true and complete to the best of my knowledge.";
  y = wrap(page, f, text, 40, y, 515, 10, 14);

  y -= 30;
  page.drawLine({ start: { x: 40, y }, end: { x: 280, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: 320, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawText("Applicant signature", { x: 40, y: y - 12, size: 8, font: f });
  page.drawText("Date", { x: 320, y: y - 12, size: 8, font: f });

  return await pdf.save();
}

// ============================================================
// SHARED LAYOUT HELPERS
// ============================================================
function drawHeader(page: PDFPage, fb: PDFFont, f: PDFFont, title: string, sub: string) {
  page.drawRectangle({ x: 0, y: 800, width: 595.28, height: 42, color: rgb(0.06, 0.18, 0.45) });
  page.drawText("UNIVERSITY OF FORT HARE", { x: 40, y: 822, size: 12, font: fb, color: rgb(1, 1, 1) });
  page.drawText("Together in Excellence", { x: 40, y: 808, size: 8, font: f, color: rgb(0.85, 0.9, 1) });
  page.drawText(title, { x: 40, y: 778, size: 13, font: fb, color: rgb(0.06, 0.18, 0.45) });
  page.drawText(sub, { x: 40, y: 762, size: 8, font: f, color: rgb(0.35, 0.35, 0.4) });
  page.drawLine({ start: { x: 40, y: 755 }, end: { x: 555, y: 755 }, thickness: 0.5, color: rgb(0.7, 0.75, 0.85) });
}

function section(page: PDFPage, fb: PDFFont, title: string, y: number) {
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 16, color: rgb(0.83, 0.86, 0.93) });
  page.drawText(title, { x: 46, y: y, size: 9, font: fb, color: rgb(0.08, 0.18, 0.4) });
  return y - 18;
}

function grid(page: PDFPage, f: PDFFont, fb: PDFFont, rows: Array<[string, any, string, any]>, y: number) {
  const left = 40, mid = 297.5, right = 555, h = 22;
  for (const r of rows) {
    page.drawRectangle({ x: left, y: y - h, width: 515, height: h, borderColor: rgb(0.75, 0.78, 0.85), borderWidth: 0.4, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: left, y: y - h, width: 110, height: h, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.75, 0.78, 0.85), borderWidth: 0.4 });
    page.drawRectangle({ x: mid, y: y - h, width: 110, height: h, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.75, 0.78, 0.85), borderWidth: 0.4 });
    page.drawText(String(r[0] ?? ""), { x: left + 4, y: y - 14, size: 8, font: fb, color: rgb(0.15, 0.15, 0.25) });
    page.drawText(String(r[1] ?? ""), { x: left + 116, y: y - 14, size: 9, font: f });
    page.drawText(String(r[2] ?? ""), { x: mid + 4, y: y - 14, size: 8, font: fb, color: rgb(0.15, 0.15, 0.25) });
    page.drawText(String(r[3] ?? ""), { x: mid + 116, y: y - 14, size: 9, font: f });
    y -= h;
  }
  return y;
}

function wrap(page: PDFPage, f: PDFFont, text: string, x: number, y: number, maxW: number, size: number, lh: number) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(t, size) > maxW && line) {
      page.drawText(line, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.15) });
      y -= lh; line = w;
    } else line = t;
  }
  if (line) { page.drawText(line, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.15) }); y -= lh; }
  return y;
}

function initials(name?: string | null) {
  if (!name) return "";
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).join("").toUpperCase();
}
function surname(name?: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}