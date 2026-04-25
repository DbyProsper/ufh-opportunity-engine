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
import { ArrowRight, FileText, CheckCircle2, Clock, AlertCircle, User as UserIcon } from "lucide-react";

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
      setLoading(false);
    })();
  }, [user]);

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
          <StatCard icon={AlertCircle} label="Eligible" value={eligibleCount} color="accent" />
        </div>

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