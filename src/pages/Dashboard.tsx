import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { UFHStateLoader } from "@/components/UFHStateLoader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkEligibility } from "@/lib/eligibility";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FileText, CheckCircle2, Clock, AlertCircle, User as UserIcon, Activity, Bell, History, ExternalLink, Eye } from "lucide-react";
import { Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { OpportunityDetailsDialog } from "@/components/OpportunityDetailsDialog";
import { OpportunityImage } from "@/components/OpportunityImage";
import { Badge } from "@/components/ui/badge";
import { getVisibleApplications } from "@/lib/applicationHistory";

type Workflow = Tables<"workflows">;
type Application = Tables<"applications">;
type ExternalOpp = Tables<"external_opportunities">;

const Dashboard = () => {
  const { user, loading: authLoading, roles } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rules, setRules] = useState<Tables<"eligibility_rules">[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [externals, setExternals] = useState<ExternalOpp[]>([]);
  const [externalOpen, setExternalOpen] = useState<ExternalOpp | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedApps, setDismissedApps] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | { kind: "delete" | "withdraw"; app: Application; wfName: string }>(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    setLoading(true);
    setShowLoader(true);

    const minDisplayTimer = window.setTimeout(() => {
      if (mounted) setShowLoader(false);
    }, 400);

    (async () => {
      const [profRes, wfRes, ruleRes, appRes, extRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("workflows").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("eligibility_rules").select("*"),
        supabase.from("applications").select("*").eq("user_id", user.id),
        supabase.from("external_opportunities" as any).select("*").eq("status", "published").order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      setProfile(profRes.data);
      setWorkflows(wfRes.data ?? []);
      setRules(ruleRes.data ?? []);
      setApps(appRes.data ?? []);
      setExternals(((extRes as any).data ?? []) as ExternalOpp[]);

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (!mounted) return;

      setUnreadCount(count ?? 0);
      window.clearTimeout(minDisplayTimer);
      setLoading(false);
      setShowLoader(false);

      // Only redirect to profile if the user explicitly needs to complete it.
      // Avoid forcing navigation away from the dashboard on every initial load.
      const p = profRes.data;
      const essentialMissing = !p?.full_name?.trim() || !p?.phone?.trim();
      if (essentialMissing && window.location.pathname === "/dashboard") {
        const hasVisitedProfile = sessionStorage.getItem("ufh_profile_prompt_seen") === "1";
        if (!hasVisitedProfile) {
          sessionStorage.setItem("ufh_profile_prompt_seen", "1");
        }
      }
    })();

    return () => {
      mounted = false;
      window.clearTimeout(minDisplayTimer);
    };
  }, [user, roles, navigate]);

  const visibleApps = getVisibleApplications(apps, dismissedApps);

  const eligibleCount = workflows.filter(
    (w) => checkEligibility(profile, roles, w, rules.filter((r) => r.workflow_id === w.id)).eligible
  ).length;

  const isStaff = roles.includes("staff");
  const missingProfileBits: string[] = [];
  if (!profile?.full_name) missingProfileBits.push("full name");
  if (!profile?.phone) missingProfileBits.push("phone");
  if (!profile?.id_number) missingProfileBits.push("ID/passport");
  if (!profile?.faculty) missingProfileBits.push("faculty");
  if (!profile?.department) missingProfileBits.push("department");
  if (!isStaff && !profile?.student_number) missingProfileBits.push("student number");
  const profileComplete = missingProfileBits.length === 0;

  if (loading || showLoader) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-12">
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border bg-card/50">
            <UFHStateLoader message="Loading your dashboard..." />
          </div>
        </main>
      </div>
    );
  }

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "delete") {
        const { error } = await supabase.from("applications").delete().eq("id", confirm.app.id);
        if (error) throw error;
        setApps((p) => p.filter((a) => a.id !== confirm.app.id));
        toast.success("Draft deleted");
      } else {
        const { error } = await (supabase as any).rpc("withdraw_application", { _id: confirm.app.id });
        if (error) throw error;
        setApps((p) => p.map((a) => a.id === confirm.app.id ? { ...a, status: "withdrawn" as any } : a));
        toast.success("Application withdrawn");
      }
      setConfirm(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
        {/* Welcome */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {eligibleCount} {eligibleCount === 1 ? "opportunity" : "opportunities"} match your profile right now.
          </p>
        </div>

        {!profileComplete && (
          <Card className="mb-6 border-accent/40 bg-accent/5">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Complete your profile to unlock more opportunities</h3>
                <p className="text-sm text-muted-foreground">
                  Still missing: {missingProfileBits.slice(0, 5).join(", ")}{missingProfileBits.length > 5 ? "…" : ""}. A complete profile is matched to more opportunities.
                </p>
              </div>
              <Link to="/profile" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto btn-gradient-primary text-primary-foreground">
                  Complete now <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={FileText} label="My Applications" value={visibleApps.length} color="primary"
            onClick={() => document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" })} />
          <StatCard icon={Clock} label="In Progress" value={visibleApps.filter(a => a.status === "draft" || a.status === "submitted" || a.status === "under_review").length} color="warning"
            onClick={() => document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" })} />
          <StatCard icon={CheckCircle2} label="Approved" value={visibleApps.filter(a => a.status === "approved").length} color="success"
            onClick={() => document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" })} />
          <Link to="/notifications" className="block">
            <Card className="border-0 shadow-sm hover:shadow-md transition relative">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-2 relative`}>
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Unread alerts</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* My Applications */}
        <section id="my-applications" className="mb-10 scroll-mt-24 relative min-h-[220px]">
          {loading ? (
            <UFHStateLoader message="Loading your applications..." />
          ) : visibleApps.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold text-foreground">My Applications</h2>
                <Link to="/applications" className="text-sm text-primary hover:underline">View all history</Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleApps.map((app) => {
                const wf = workflows.find((w) => w.id === app.workflow_id);
                if (!wf) return null;
                const canDelete = app.status === "draft";
                const canWithdraw = app.status === "submitted";
                return (
                  <Card key={app.id} className="hover:shadow-lg transition-all h-full flex flex-col relative">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-2 top-2 h-8 w-8 rounded-full"
                      onClick={() => setDismissedApps((prev) => [...prev, app.id])}
                      title="Hide from dashboard"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                    <CardContent className="p-5 flex-1 flex flex-col pr-12">
                      <Link to={`/apply/${wf.slug}`} className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold leading-tight">{wf.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium status-${app.status.replace("_","-")}`}>
                            {app.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{wf.description}</p>
                      </Link>
                      {(canDelete || canWithdraw) && (
                        <div className="flex gap-1.5 mt-3 pt-3 border-t">
                          {canDelete && (
                            <Button size="sm" variant="outline" className="text-destructive flex-1"
                              onClick={() => setConfirm({ kind: "delete", app, wfName: wf.name })}>
                              <Trash2 className="w-3 h-3 mr-1" /> Delete draft
                            </Button>
                          )}
                          {canWithdraw && (
                            <Button size="sm" variant="outline" className="text-destructive flex-1"
                              onClick={() => setConfirm({ kind: "withdraw", app, wfName: wf.name })}>
                              <XCircle className="w-3 h-3 mr-1" /> Withdraw
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
                })}
              </div>
            </>
          ) : null}
        </section>

        {/* Opportunities */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Opportunities</h2>
            <span className="text-sm text-muted-foreground">{workflows.length} available</span>
          </div>
          {workflows.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">No active opportunities right now. Check back soon.</CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {workflows.map((wf) => {
                const elig = checkEligibility(profile, roles, wf, rules.filter((r) => r.workflow_id === wf.id));
                const myApp = apps.find((a) => a.workflow_id === wf.id);
                return (
                  <OpportunityCard
                    key={wf.id}
                    workflow={wf}
                    eligible={elig.eligible}
                    reasons={elig.reasons}
                    applicationStatus={myApp?.status ?? null}
                    profile={profile}
                    roles={roles}
                    rules={rules.filter((r) => r.workflow_id === wf.id)}
                    userId={user?.id}
                  />
                );
              })}
            </div>
          )}

          {externals.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-accent" /> External opportunities
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {externals.map((e) => (
                  <Card key={e.id} className="cursor-pointer hover:shadow-lg transition overflow-hidden" onClick={() => setExternalOpen(e)}>
                    <OpportunityImage
                      image_url={(e as any).image_url}
                      category={(e as any).category}
                      name={e.title}
                      description={e.description}
                      aspect="video"
                    />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold leading-tight">{e.title}</h4>
                        <Badge variant="outline"><ExternalLink className="w-3 h-3 mr-1" />External</Badge>
                      </div>
                      {e.organization && <p className="text-xs text-muted-foreground mb-2">{e.organization}</p>}
                      <p className="text-sm text-muted-foreground line-clamp-3">{e.description}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={(ev) => { ev.stopPropagation(); setExternalOpen(e); }}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> View & apply externally
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {externalOpen && (
        <OpportunityDetailsDialog
          open={!!externalOpen}
          onClose={() => setExternalOpen(null)}
          externalOpp={externalOpen}
          profile={profile}
          roles={roles}
          rules={[]}
          userId={user?.id}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? `Delete draft for "${confirm.wfName}"?` : `Withdraw "${confirm?.wfName}" application?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? "This permanently removes your draft and any answers you've saved. This cannot be undone."
                : "Reviewers will be notified that you have withdrawn. You can re-apply later if the workflow is still open."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {confirm?.kind === "delete" ? "Delete draft" : "Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: number; color: string; onClick?: () => void }) => (
  <Card className="border-0 shadow-sm hover:shadow-md transition cursor-pointer" onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
    <CardContent className="p-4">
      <div className={`w-9 h-9 rounded-lg bg-${color}/10 text-${color} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export default Dashboard;