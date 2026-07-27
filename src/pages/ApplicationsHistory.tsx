import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { OpportunityImage } from "@/components/OpportunityImage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UFHStateLoader } from "@/components/UFHStateLoader";
import { getApplicationVerdictSummary } from "@/lib/applicationHistory";
import { formatDistanceToNow } from "date-fns";
import { FileText, History } from "lucide-react";

type Application = Tables<"applications">;
type Workflow = Tables<"workflows">;

const ApplicationsHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<{ app: Application; workflow: Workflow | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [appRes, wfRes] = await Promise.all([
        supabase.from("applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("workflows").select("*").eq("is_active", true),
      ]);

      setApps((appRes.data as Application[]) ?? []);
      setWorkflows((wfRes.data as Workflow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const grouped = useMemo(() => {
    return apps.map((app) => {
      const workflow = workflows.find((wf) => wf.id === app.workflow_id);
      return { app, workflow };
    }).filter((item) => item.workflow);
  }, [apps, workflows]);

  const selectedSummary = selectedEntry ? getApplicationVerdictSummary(selectedEntry.app) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-12">
          <div className="relative min-h-[320px] overflow-hidden rounded-2xl border bg-card/50">
            <UFHStateLoader message="Loading your application history..." />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-4xl w-full">
        <BackButton to="/dashboard" label="Back to dashboard" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My applications</h1>
            <p className="text-sm text-muted-foreground">A permanent record of your applications and their current status.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
            <History className="w-4 h-4" /> {grouped.length} total
          </div>
        </div>

        {grouped.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              You have not started any applications yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ app, workflow }) => {
              const summary = getApplicationVerdictSummary(app);
              return (
                <button key={app.id} type="button" onClick={() => setSelectedEntry({ app, workflow: workflow ?? null })} className="w-full text-left">
                  <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="overflow-hidden">
                      <OpportunityImage
                        image_url={workflow?.image_url}
                        category={workflow?.category}
                        name={workflow?.name}
                        description={workflow?.description}
                        aspect="wide"
                        className="h-36 w-full"
                        alt={`${workflow?.name ?? "Opportunity"} cover`}
                      />
                    </div>
                    <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-semibold">{workflow?.name}</h2>
                          <p className="text-sm text-muted-foreground line-clamp-2">{workflow?.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <Badge className="capitalize">{summary.title}</Badge>
                        {app.submitted_at && (
                          <p className="text-xs text-muted-foreground">Submitted {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-left">{selectedEntry?.workflow?.name ?? "Application details"}</DialogTitle>
          </DialogHeader>
          {selectedEntry && selectedSummary && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <OpportunityImage
                  image_url={selectedEntry.workflow?.image_url}
                  category={selectedEntry.workflow?.category}
                  name={selectedEntry.workflow?.name}
                  description={selectedEntry.workflow?.description}
                  aspect="wide"
                  className="h-44 w-full"
                  alt={`${selectedEntry.workflow?.name ?? "Opportunity"} cover`}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="capitalize">{selectedSummary.title}</Badge>
                <p className="text-sm text-muted-foreground">
                  Started {formatDistanceToNow(new Date(selectedEntry.app.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Current verdict</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedSummary.body}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1 font-medium capitalize">{selectedEntry.app.status.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
                  <p className="mt-1 font-medium">{selectedEntry.app.submitted_at ? formatDistanceToNow(new Date(selectedEntry.app.submitted_at), { addSuffix: true }) : "Not submitted yet"}</p>
                </div>
              </div>
              {selectedEntry.app.review_notes && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">Reviewer notes</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{selectedEntry.app.review_notes}</p>
                </div>
              )}
              {selectedEntry.app.rejection_reason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive">Rejection reason</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{selectedEntry.app.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApplicationsHistory;
