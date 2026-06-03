import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Missing token" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const actor = userRes.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", actor.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) return json({ error: "Only super admins can create invites" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "");
    const reason = String(body.reason ?? "").trim();

    if (!/^[a-z0-9._%+-]+@ufh\.ac\.za$/.test(email)) {
      return json({ error: "Only @ufh.ac.za emails can be invited" }, 400);
    }
    if (!["admin", "reviewer"].includes(role)) {
      return json({ error: "Role must be admin or reviewer" }, 400);
    }
    if (reason.length < 5) return json({ error: "Reason is required (min 5 chars)" }, 400);

    // Cancel any existing pending invite for the same email
    await admin.from("admin_invites")
      .update({ status: "expired" })
      .eq("email", email).eq("status", "pending");

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error: insErr } = await admin.from("admin_invites").insert({
      email, role, invited_by: actor.id, reason, token,
    }).select().single();
    if (insErr) return json({ error: insErr.message }, 400);

    await admin.from("admin_audit_logs").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action: "invite_created",
      target_email: email,
      role,
      reason,
      metadata: { invite_id: inv.id },
    });

    const acceptUrl = `${req.headers.get("origin") ?? ""}/accept-invite?token=${token}`;
    return json({ ok: true, invite: inv, accept_url: acceptUrl });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}