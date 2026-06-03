import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldAlert, UserPlus, Copy, Trash2, History, Mail, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

type Role = "super_admin" | "admin" | "reviewer";

interface AdminRow { user_id: string; role: Role; email: string | null; full_name: string | null; created_at: string; }
interface InviteRow { id: string; email: string; role: Role; status: string; reason: string; token: string; created_at: string; expires_at: string; invited_by: string; }
interface AuditRow { id: string; actor_email: string | null; action: string; target_email: string | null; role: string | null; reason: string | null; created_at: string; }

const roleTone = (r: string) =>
  r === "super_admin" ? "bg-destructive/15 text-destructive" :
  r === "admin" ? "bg-primary/15 text-primary" :
  "bg-success/15 text-success";

const actionLabel: Record<string, string> = {
  invite_created: "Invite sent",
  invite_accepted: "Invite accepted",
  role_revoked: "Role revoked",
};

export const AdminManagement = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "reviewer">("admin");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [revoke, setRevoke] = useState<AdminRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: roleRows } = await supabase.from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["super_admin","admin","reviewer"]);
    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    let profs: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      profs = data ?? [];
    }
    const profMap = new Map(profs.map((p: any) => [p.id, p]));
    setAdmins((roleRows ?? []).map((r: any) => ({
      user_id: r.user_id, role: r.role, created_at: r.created_at,
      email: profMap.get(r.user_id)?.email ?? null,
      full_name: profMap.get(r.user_id)?.full_name ?? null,
    })));

    const { data: inv } = await (supabase.from as any)("admin_invites")
      .select("*").order("created_at", { ascending: false }).limit(50);
    setInvites((inv as InviteRow[]) ?? []);

    const { data: aud } = await (supabase.from as any)("admin_audit_logs")
      .select("*").order("created_at", { ascending: false }).limit(100);
    setAudit((aud as AuditRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!email || !reason) { toast.error("Email and reason are required"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("create-admin-invite", {
      body: { email, role, reason },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to create invite");
      return;
    }
    const url = (data as any)?.accept_url;
    if (url) {
      try { await navigator.clipboard.writeText(url); toast.success("Invite created — link copied"); }
      catch { toast.success("Invite created"); }
    }
    setInviteOpen(false);
    setEmail(""); setReason(""); setRole("admin");
    load();
  };

  const handleRevoke = async () => {
    if (!revoke) return;
    if (revokeReason.trim().length < 3) { toast.error("Provide a reason"); return; }
    const { error } = await supabase.rpc("revoke_admin_role", {
      _target: revoke.user_id, _role: revoke.role, _reason: revokeReason,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Access revoked");
    setRevoke(null); setRevokeReason("");
    load();
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Invite link copied"); }
    catch { toast.error("Copy failed — link: " + url); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Admin Access Management</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isSuperAdmin ? "You are a super admin. Manage who can administer this platform." : "Read-only view — only super admins can change roles."}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} disabled={!isSuperAdmin} className="gap-2">
          {isSuperAdmin ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          Invite Admin
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="admins">
          <TabsList>
            <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
            <TabsTrigger value="invites">Invites ({invites.filter(i => i.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="audit"><History className="w-3.5 h-3.5 mr-1" />Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="space-y-2 mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
              admins.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No administrators.</p> :
              admins.map((a) => (
                <div key={`${a.user_id}-${a.role}`} className="flex items-center gap-3 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.full_name || a.email || a.user_id.slice(0,8)}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                  <Badge className={roleTone(a.role)}>{a.role.replace("_"," ")}</Badge>
                  <span className="text-[10px] text-muted-foreground hidden md:inline">since {new Date(a.created_at).toLocaleDateString()}</span>
                  <Button
                    variant="ghost" size="sm"
                    disabled={!isSuperAdmin || a.user_id === user?.id}
                    onClick={() => setRevoke(a)}
                    title={a.user_id === user?.id ? "You cannot revoke your own role" : "Revoke access"}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))
            }
          </TabsContent>

          <TabsContent value="invites" className="space-y-2 mt-4">
            {invites.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No invites.</p> :
              invites.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-3 border rounded-md flex-wrap">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.email}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{i.reason}</p>
                  </div>
                  <Badge className={roleTone(i.role)}>{i.role}</Badge>
                  <Badge variant={i.status === "pending" ? "default" : "outline"}>{i.status}</Badge>
                  {i.status === "pending" && isSuperAdmin && (
                    <Button variant="outline" size="sm" onClick={() => copyLink(i.token)} className="gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </Button>
                  )}
                  <span className="text-[10px] text-muted-foreground">expires {new Date(i.expires_at).toLocaleDateString()}</span>
                </div>
              ))
            }
          </TabsContent>

          <TabsContent value="audit" className="space-y-1.5 mt-4">
            {audit.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No audit entries yet.</p> :
              audit.map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-2.5 border rounded-md text-sm">
                  <Badge variant="outline" className="font-mono text-[10px]">{actionLabel[e.action] || e.action}</Badge>
                  <span className="flex-1 truncate">
                    <span className="font-medium">{e.actor_email || "system"}</span>
                    {e.target_email && <> → <span className="font-medium">{e.target_email}</span></>}
                    {e.role && <> · <span className="text-muted-foreground">{e.role}</span></>}
                    {e.reason && <span className="text-muted-foreground"> · "{e.reason}"</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              ))
            }
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Invite an administrator</DialogTitle>
            <DialogDescription>Only @ufh.ac.za emails can be invited. The invitee will receive the role automatically when they sign up or open the link while signed in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="name@ufh.ac.za" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="admin">Admin — manage applications & workflows</SelectItem>
                  <SelectItem value="reviewer">Reviewer — view, approve, reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for access</Label>
              <Textarea placeholder="e.g. Faculty office bursary reviewer for 2026 cycle" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={sending}>
              {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revoke} onOpenChange={(o) => { if (!o) { setRevoke(null); setRevokeReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-destructive" /> Revoke {revoke?.role.replace("_"," ")} access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the <strong>{revoke?.role}</strong> role from {revoke?.email}. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Reason</Label>
            <Textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={2} placeholder="Why is this access being removed?" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AdminManagement;