import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkEligibility } from "@/lib/eligibility";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FileText, CheckCircle2, Clock, AlertCircle, User as UserIcon, Activity, Bell, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Workflow = Tables<"workflows">;
type Application = Tables<"applications">;

const Dashboard = () => {
  const { user, loading: authLoading, roles } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rules, setRules] = useState<Tables<"eligibility_rules">[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profRes, wfRes, ruleRes, appRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("workflows").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("eligibility_rules").select("*"),
        supabase.from("applications").select("*").eq("user_id", user.id),
      ]);
      setProfile(profRes.data);
      setWorkflows(wfRes.data ?? []);
      setRules(ruleRes.data ?? []);
      setApps(appRes.data ?? []);

      const appIds = (appRes.data ?? []).map((a: any) => a.id);
      if (appIds.length) {
        const { data: evs } = await supabase
          .from("application_events")
          .select("*")
          .in("application_id", appIds)
          .order("created_at", { ascending: false })
          .limit(10);
        setRecentEvents(evs ?? []);
      }

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      setUnreadCount(count ?? 0);

      if (roles.includes("admin")) {
        const { data: au } = await supabase
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8);
        setAuditEvents(au ?? []);
      }

      setLoading(false);

      // Profile-first: if essential profile is empty, push to /profile
      const p = profRes.data;
      const essentialMissing = !p?.full_name?.trim() || !p?.phone?.trim();
      if (essentialMissing) {
        navigate("/profile", { replace: true });
      }
    })();
  }, [user, roles, navigate]);

  const eligibleCount = workflows.filter(
    (w) => checkEligibility(profile, roles, w, rules.filter((r) => r.workflow_id === w.id)).eligible
  ).length;

  const profileComplete = !!(profile?.full_name && profile?.student_number && profile?.faculty && profile?.department);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
          </div>
        </div>
      </div>
    );
  }

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
                <h3 className="font-semibold">Complete your profile</h3>
                <p className="text-sm text-muted-foreground">
                  Add your faculty, department and student number so applications auto-fill.
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
          <StatCard icon={FileText} label="My Applications" value={apps.length} color="primary" />
          <StatCard icon={Clock} label="In Progress" value={apps.filter(a => a.status === "draft" || a.status === "submitted" || a.status === "under_review").length} color="warning" />
          <StatCard icon={CheckCircle2} label="Approved" value={apps.filter(a => a.status === "approved").length} color="success" />
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

        {/* Recent activity */}
        {recentEvents.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Recent activity</h2>
            </div>
            <Card>
              <CardContent className="p-0 divide-y">
                {recentEvents.map((e) => {
                  const app = apps.find((a) => a.id === e.application_id);
                  const wf = workflows.find((w) => w.id === app?.workflow_id);
                  const title = e.event_type === "status_change"
                    ? `Status → ${(e.to_status ?? "").replace(/_/g, " ")}`
                    : e.event_type.replace(/_/g, " ");
                  return (
                    <Link
                      key={e.id}
                      to={wf ? `/apply/${wf.slug}` : "/dashboard"}
                      className="flex items-center justify-between p-3 hover:bg-muted/40 gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize truncate">{title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {wf?.name ?? "Application"} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        )}

        {isAdmin && auditEvents.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Latest audit events</h2>
              <Link to="/admin/audit" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <Card>
              <CardContent className="p-0 divide-y">
                {auditEvents.map((a) => (
                  <div key={a.id} className="p-3 text-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate"><span className="uppercase text-[10px] tracking-wide text-muted-foreground mr-1.5">{a.operation}</span>{a.table_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.actor_email ?? "system"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {/* My Applications */}
        {apps.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">My Applications</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.map((app) => {
                const wf = workflows.find((w) => w.id === app.workflow_id);
                if (!wf) return null;
                return (
                  <Link key={app.id} to={`/apply/${wf.slug}`}>
                    <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold leading-tight">{wf.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium status-${app.status.replace("_","-")}`}>
                            {app.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{wf.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

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
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <Card className="border-0 shadow-sm">
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