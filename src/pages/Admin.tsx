import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { rankApplicants } from "@/lib/eligibility";
import { Loader2, Plus, Sparkles, Eye, Check, X, ShieldAlert, Search, Settings2, Users, GraduationCap } from "lucide-react";
import { WorkflowEditor } from "@/components/admin/WorkflowEditor";
import { ApplicationDetail } from "@/components/admin/ApplicationDetail";

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("applications");
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWf, setNewWf] = useState({ name: "", slug: "", description: "" });
  const [editingWf, setEditingWf] = useState<string | null>(null);
  const [viewingApp, setViewingApp] = useState<string | null>(null);

  // filters
  const [audienceTab, setAudienceTab] = useState<"all" | "student" | "staff">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [wfRes, appsRes, profRes] = await Promise.all([
        supabase.from("workflows").select("*").order("created_at", { ascending: false }),
        supabase.from("applications").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,student_number,staff_number,faculty,department"),
      ]);
      setWorkflows(wfRes.data ?? []);
      setApplications(appsRes.data ?? []);
      setProfiles(profRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (!authLoading && user && !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto py-16 max-w-md text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Admin access required</h2>
          <p className="text-muted-foreground mb-4">
            To grant yourself admin access, run this in the Cloud SQL editor:<br/>
            <code className="text-xs bg-muted p-1 rounded">INSERT INTO user_roles (user_id, role) VALUES ('{user?.id}', 'admin');</code>
          </p>
          <Link to="/dashboard"><Button variant="outline">Back to dashboard</Button></Link>
        </div>
      </div>
    );
  }

  const updateAppStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("applications").update({
      status: status as any,
      reviewed_at: new Date().toISOString(),
      reviewer_id: user!.id,
    }).eq("id", appId);
    if (error) { toast.error(error.message); return; }
    setApplications((p) => p.map((a) => a.id === appId ? { ...a, status } : a));
    const app = applications.find((a) => a.id === appId);
    if (app) {
      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: `Application ${status}`,
        body: `Your application status was updated to ${status.replace("_", " ")}.`,
        link: "/dashboard",
        type: status === "approved" ? "success" : status === "rejected" ? "error" : "info",
      });
    }
    toast.success(`Marked as ${status}`);
  };

  const createWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWf.name || !newWf.slug) { toast.error("Name and slug required"); return; }
    setCreating(true);
    const { data, error } = await supabase.from("workflows").insert({
      name: newWf.name, slug: newWf.slug, description: newWf.description,
      target_role: "student", created_by: user!.id,
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setWorkflows((p) => [data, ...p]);
    setNewWf({ name: "", slug: "", description: "" });
    toast.success("Workflow created. Add steps & fields next.");
    setEditingWf(data.id);
  };

  // Apply filters (must be before early returns to keep hook order stable)
  const filteredApps = useMemo(() => {
    return applications.filter((a) => {
      const wf = workflows.find((w) => w.id === a.workflow_id);
      if (audienceTab !== "all" && wf?.target_role !== audienceTab && wf?.target_role !== "any") return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (workflowFilter !== "all" && a.workflow_id !== workflowFilter) return false;
      if (search) {
        const prof = profiles.find((p) => p.id === a.user_id);
        const hay = `${prof?.full_name ?? ""} ${prof?.email ?? ""} ${prof?.student_number ?? ""} ${prof?.staff_number ?? ""} ${wf?.name ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, workflows, profiles, audienceTab, statusFilter, workflowFilter, search]);

  const studentCount = applications.filter((a) => {
    const wf = workflows.find((w) => w.id === a.workflow_id);
    return wf?.target_role === "student" || wf?.target_role === "any";
  }).length;
  const staffCount = applications.filter((a) => {
    const wf = workflows.find((w) => w.id === a.workflow_id);
    return wf?.target_role === "staff" || wf?.target_role === "any";
  }).length;

  if (loading) return <div className="min-h-screen bg-background"><AppHeader /><div className="container py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground text-sm">Manage workflows and review applications.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
            <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            {/* Audience tabs */}
            <Tabs value={audienceTab} onValueChange={(v) => setAudienceTab(v as any)} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">All ({applications.length})</TabsTrigger>
                <TabsTrigger value="student"><GraduationCap className="w-3.5 h-3.5 mr-1" /> Students ({studentCount})</TabsTrigger>
                <TabsTrigger value="staff"><Users className="w-3.5 h-3.5 mr-1" /> Staff ({staffCount})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filter bar */}
            <Card className="mb-4">
              <CardContent className="p-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search name, email, student #…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                  <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All workflows</SelectItem>
                    {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(search || statusFilter !== "all" || workflowFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setWorkflowFilter("all"); }}>
                    Clear
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{filteredApps.length} {filteredApps.length === 1 ? "result" : "results"}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => { rankApplicants(applications); toast.info("AI ranking — coming soon"); }}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-accent" /> Rank Applicants
                </Button>
              </CardHeader>
              <CardContent>
                {filteredApps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No applications match these filters.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredApps.map((a) => {
                      const wf = workflows.find((w) => w.id === a.workflow_id);
                      const prof = profiles.find((p) => p.id === a.user_id);
                      return (
                        <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              {prof?.full_name || prof?.email || "Unknown"}
                              <span className="text-muted-foreground font-normal"> — {wf?.name}</span>
                              {wf?.target_role === "staff" && <Badge variant="outline" className="ml-2 text-[10px]">Staff</Badge>}
                              {wf?.target_role === "student" && <Badge variant="outline" className="ml-2 text-[10px]">Student</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">{prof?.faculty} · {prof?.department}</p>
                          </div>
                          <Badge className={`status-${a.status.replace("_","-")} capitalize`}>{a.status.replace("_"," ")}</Badge>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setViewingApp(a.id)}><Eye className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="outline" className="text-success" onClick={() => updateAppStatus(a.id, "approved")}><Check className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateAppStatus(a.id, "rejected")}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Workflows</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="btn-gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1.5" /> New Workflow</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Workflow</DialogTitle></DialogHeader>
                  <form onSubmit={createWorkflow} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newWf.name} onChange={(e) => setNewWf({ ...newWf, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input value={newWf.slug} onChange={(e) => setNewWf({ ...newWf, slug: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={newWf.description} onChange={(e) => setNewWf({ ...newWf, description: e.target.value })} rows={3} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="font-semibold">{w.name}</h3>
                      <Badge variant={w.is_active ? "default" : "outline"}>{w.is_active ? "Active" : "Draft"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{w.description}</p>
                    <p className="text-xs text-muted-foreground">/{w.slug}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground">
                        {applications.filter((a) => a.workflow_id === w.id).length} applications
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setEditingWf(w.id)}>
                        <Settings2 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {editingWf && (
          <WorkflowEditor workflowId={editingWf} onClose={() => {
            setEditingWf(null);
            // refresh workflows so meta changes show
            supabase.from("workflows").select("*").order("created_at", { ascending: false }).then(({ data }) => setWorkflows(data ?? []));
          }} />
        )}
        {viewingApp && (
          <ApplicationDetail
            applicationId={viewingApp}
            onClose={() => setViewingApp(null)}
            onStatusChange={(id, status) => setApplications((p) => p.map((a) => a.id === id ? { ...a, status } : a))}
          />
        )}
      </main>
    </div>
  );
};

export default Admin;