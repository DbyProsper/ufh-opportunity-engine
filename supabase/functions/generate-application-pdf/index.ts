// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: verify user from JWT, then use service client for all reads.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { applicationId, includeOfferSigned } = await req.json().catch(() => ({}));
    if (!applicationId || typeof applicationId !== "string") {
      return new Response(JSON.stringify({ error: "applicationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorize: applicant or admin
    const { data: app } = await admin
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    if (app.user_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather data
    const [{ data: profile }, { data: workflow }, { data: steps }, { data: fields }, { data: responses }, { data: docFiles }, { data: docMeta }] =
      await Promise.all([
        admin.from("profiles").select("*").eq("id", app.user_id).maybeSingle(),
        admin.from("workflows").select("*").eq("id", app.workflow_id).maybeSingle(),
        admin.from("workflow_steps").select("*").eq("workflow_id", app.workflow_id).order("step_order"),
        admin.from("workflow_fields").select("*").eq("workflow_id", app.workflow_id).order("field_order"),
        admin.from("application_responses").select("*").eq("application_id", applicationId),
        admin.from("application_documents").select("*").eq("application_id", applicationId),
        admin.from("workflow_documents").select("*").eq("workflow_id", app.workflow_id),
      ]);

    const respMap: Record<string, string> = {};
    (responses ?? []).forEach((r: any) => { respMap[r.field_id] = r.value ?? ""; });

    // Build base PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const lineH = 14;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const ensureSpace = (need: number) => {
      if (y - need < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawText = (text: string, opts?: { bold?: boolean; size?: number; color?: any; indent?: number }) => {
      const size = opts?.size ?? 10;
      const f = opts?.bold ? fontBold : font;
      const indent = opts?.indent ?? 0;
      const maxWidth = pageWidth - margin * 2 - indent;
      // Naive word wrap
      const words = String(text ?? "").split(/\s+/);
      let line = "";
      const flush = () => {
        ensureSpace(size + 4);
        page.drawText(line, { x: margin + indent, y, size, font: f, color: opts?.color ?? rgb(0.1, 0.1, 0.15) });
        y -= size + 4;
        line = "";
      };
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        const width = f.widthOfTextAtSize(test, size);
        if (width > maxWidth && line) {
          flush();
          line = w;
        } else {
          line = test;
        }
      }
      if (line) flush();
    };

    const hr = () => {
      ensureSpace(8);
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.8, 0.82, 0.88) });
      y -= 8;
    };

    // Header
    drawText("UFH Opportunity Hub", { bold: true, size: 18, color: rgb(0.1, 0.2, 0.5) });
    drawText("Application Pack", { size: 11, color: rgb(0.4, 0.4, 0.45) });
    y -= 6; hr();

    drawText(workflow?.name ?? "Application", { bold: true, size: 14 });
    drawText(`Status: ${app.status}`, { size: 10 });
    drawText(`Submitted: ${app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"}`, { size: 10 });
    drawText(`Application ID: ${app.id}`, { size: 9, color: rgb(0.5, 0.5, 0.55) });
    y -= 4; hr();

    // Applicant info
    drawText("Applicant", { bold: true, size: 12 });
    const info: [string, string | null | undefined][] = [
      ["Full name", profile?.full_name],
      ["Email", profile?.email],
      ["Phone", profile?.phone],
      ["Student #", profile?.student_number],
      ["Staff #", profile?.staff_number],
      ["Faculty", profile?.faculty],
      ["Department", profile?.department],
      ["Qualification", profile?.qualification],
      ["Year of study", profile?.year_of_study],
      ["Address", profile?.address],
    ];
    for (const [k, v] of info) {
      if (!v) continue;
      drawText(`${k}: ${v}`, { size: 10, indent: 6 });
    }
    y -= 4; hr();

    // Responses by step
    drawText("Responses", { bold: true, size: 12 });
    for (const s of steps ?? []) {
      const sf = (fields ?? []).filter((f: any) => f.step_id === s.id);
      if (sf.length === 0) continue;
      y -= 2;
      drawText(s.title, { bold: true, size: 11 });
      for (const f of sf) {
        drawText(f.label, { size: 9, color: rgb(0.4, 0.4, 0.45), indent: 6 });
        drawText(respMap[f.id] || "—", { size: 10, indent: 12 });
      }
    }
    y -= 4; hr();

    // Documents list
    drawText("Attached documents", { bold: true, size: 12 });
    if (!docFiles || docFiles.length === 0) {
      drawText("None uploaded.", { size: 10, indent: 6, color: rgb(0.5, 0.5, 0.55) });
    } else {
      for (const d of docFiles) {
        const meta = (docMeta ?? []).find((m: any) => m.id === d.document_id);
        drawText(`• ${meta?.name ?? d.file_name}`, { size: 10, indent: 6 });
        drawText(`   ${d.file_name}`, { size: 9, color: rgb(0.5, 0.5, 0.55), indent: 6 });
      }
    }

    // Merge PDF attachments
    for (const d of docFiles ?? []) {
      const isPdf = (d.file_name ?? "").toLowerCase().endsWith(".pdf");
      if (!isPdf) continue;
      try {
        const dl = await admin.storage.from("application-documents").download(d.file_path);
        if (dl.error || !dl.data) continue;
        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        // Separator page
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawText("Attachment", { size: 10, color: rgb(0.5, 0.5, 0.55) });
        const meta = (docMeta ?? []).find((m: any) => m.id === d.document_id);
        drawText(meta?.name ?? d.file_name, { bold: true, size: 14 });
        drawText(d.file_name, { size: 10, color: rgb(0.5, 0.5, 0.55) });
        const copied = await pdf.copyPages(src, src.getPageIndices());
        copied.forEach((p) => pdf.addPage(p));
      } catch (e) {
        console.error("merge failed", d.file_name, e);
      }
    }

    // Optionally append the latest signed offer document
    if (includeOfferSigned) {
      try {
        const { data: offerRow } = await admin
          .from("offers").select("id").eq("application_id", applicationId).maybeSingle();
        if (offerRow) {
          const { data: signedDocs } = await admin
            .from("offer_documents")
            .select("*")
            .eq("offer_id", offerRow.id)
            .eq("kind", "signed")
            .order("version", { ascending: false })
            .limit(1);
          const latest = signedDocs?.[0];
          if (latest && (latest.file_name ?? "").toLowerCase().endsWith(".pdf")) {
            const dl = await admin.storage.from("offer-signed").download(latest.file_path);
            if (!dl.error && dl.data) {
              const sBytes = new Uint8Array(await dl.data.arrayBuffer());
              const src = await PDFDocument.load(sBytes, { ignoreEncryption: true });
              page = pdf.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
              drawText("Signed offer", { size: 10, color: rgb(0.5, 0.5, 0.55) });
              drawText(`v${latest.version} · ${latest.file_name}`, { bold: true, size: 14 });
              const copied = await pdf.copyPages(src, src.getPageIndices());
              copied.forEach((p) => pdf.addPage(p));
            }
          }
        }
      } catch (e) {
        console.error("signed-offer merge failed", e);
      }
    }

    const bytes = await pdf.save();
    const objectPath = `${applicationId}/pack-${Date.now()}.pdf`;
    const up = await admin.storage.from("application-packs").upload(objectPath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) throw up.error;

    const signed = await admin.storage.from("application-packs").createSignedUrl(objectPath, 60 * 10);
    if (signed.error) throw signed.error;

    return new Response(JSON.stringify({ url: signed.data.signedUrl, path: objectPath }), {
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