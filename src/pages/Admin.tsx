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
import { rankApplications, RankedApplication } from "@/lib/ai";
import { RankingExplainer } from "@/components/ai/RankingExplainer";
import { Loader2, Plus, Sparkles, Eye, Check, X, ShieldAlert, Search, Settings2, Users, GraduationCap, Stamp, UserCheck } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { WorkflowEditor } from "@/components/admin/WorkflowEditor";
import { ApplicationDetail } from "@/components/admin/ApplicationDetail";
import { OfferTemplateManager } from "@/components/admin/OfferTemplateManager";
import { AIWorkflowDialog } from "@/components/admin/AIWorkflowDialog";
import { BulletinExtractor } from "@/components/admin/BulletinExtractor";
import { BackButton } from "@/components/BackButton";
import { History, FileSearch } from "lucide-react";
import { UFH_FACULTIES, UFH_FACULTY_NAMES } from "@/data/ufh";
import { AdminManagement } from "@/components/admin/AdminManagement";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-react";

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("applications");
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [externalOpps, setExternalOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWf, setNewWf] = useState({ name: "", slug: "", description: "" });
  const [editingWf, setEditingWf] = useState<string | null>(null);
  const [viewingApp, setViewingApp] = useState<string | null>(null);
  const [templatesFor, setTemplatesFor] = useState<{ id: string; name: string } | null>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [bulletinOpen, setBulletinOpen] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<null | { ids: string[] }>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteWf, setConfirmDeleteWf] = useState<null | { id: string; name: string }>(null);
  const [deletingWf, setDeletingWf] = useState(false);
  const [aiRankOn, setAiRankOn] = useState(false);
  const [rankings, setRankings] = useState<Record<string, RankedApplication>>({});
  const [explainRank, setExplainRank] = useState<{ id: string } | null>(null);
  const [computingRank, setComputingRank] = useState(false);

  // filters
  const [audienceTab, setAudienceTab] = useState<"all" | "student" | "staff">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [facultyFilter, setFacultyFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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
      const { data: extRes } = await supabase.from("external_opportunities" as any).select("*").order("created_at", { ascending: false });
      setExternalOpps((extRes as any) ?? []);
      const { data: ar } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (ar ?? []).map((r: any) => r.user_id);
      if (ids.length) {
        const { data: ap } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        setAdmins(ap ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const quickApprove = async (appId: string) => {
    const { error } = await supabase.from("applications").update({
      status: "approved" as any,
      reviewed_at: new Date().toISOString(),
      is_editable: false,
    } as any).eq("id", appId);
    if (error) return toast.error(error.message);
    setApplications((p) => p.map((a) => a.id === appId ? { ...a, status: "approved" } : a));
    const app = applications.find((a) => a.id === appId);
    if (app) {
      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: "Application approved",
        body: "Your application has been approved.",
        link: "/dashboard",
        type: "success",
      });
    }
    toast.success("Approved");
  };

  const cascadeDeleteApplications = async (ids: string[]) => {
    // remove dependents first (RLS admin delete policies were added in migration)
    // 1. offer_documents → offers tied to these apps
    const { data: offerRows } = await supabase.from("offers").select("id").in("application_id", ids);
    const offerIds = (offerRows ?? []).map((o: any) => o.id);
    if (offerIds.length) {
      await supabase.from("offer_documents").delete().in("offer_id", offerIds);
      await supabase.from("offers").delete().in("id", offerIds);
    }
    // 2. message_threads
    const { data: threadRows } = await supabase.from("message_threads").select("id").in("application_id", ids);
    const threadIds = (threadRows ?? []).map((t: any) => t.id);
    if (threadIds.length) {
      await supabase.from("messages").delete().in("thread_id", threadIds);
      await supabase.from("message_threads").delete().in("id", threadIds);
    }
    // 3. application docs/responses/affidavits
    await supabase.from("application_documents").delete().in("application_id", ids);
    await supabase.from("application_responses").delete().in("application_id", ids);
    await supabase.from("affidavit_submissions").delete().in("application_id", ids);
    // 4. applications
    const { error } = await supabase.from("applications").delete().in("id", ids);
    if (error) throw error;
  };

  const runDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await cascadeDeleteApplications(confirmDelete.ids);
      setApplications((p) => p.filter((a) => !confirmDelete.ids.includes(a.id)));
      setSelectedAppIds((p) => p.filter((id) => !confirmDelete.ids.includes(id)));
      toast.success(`Deleted ${confirmDelete.ids.length} application${confirmDelete.ids.length === 1 ? "" : "s"}`);
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    } finally { setDeleting(false); }
  };

  const runDeleteWorkflow = async () => {
    if (!confirmDeleteWf) return;
    const wfId = confirmDeleteWf.id;
    setDeletingWf(true);
    try {
      // Cascade: applications first (which cascades to their own dependents)
      const { data: wfApps } = await supabase.from("applications").select("id").eq("workflow_id", wfId);
      const appIds = (wfApps ?? []).map((a: any) => a.id);
      if (appIds.length) await cascadeDeleteApplications(appIds);

      // Workflow-owned child rows
      await supabase.from("workflow_offer_templates").delete().eq("workflow_id", wfId);
      await supabase.from("eligibility_rules").delete().eq("workflow_id", wfId);
      await supabase.from("workflow_documents").delete().eq("workflow_id", wfId);
      await supabase.from("workflow_fields").delete().eq("workflow_id", wfId);
      await supabase.from("workflow_steps").delete().eq("workflow_id", wfId);

      const { error } = await supabase.from("workflows").delete().eq("id", wfId);
      if (error) throw error;

      setWorkflows((p) => p.filter((w) => w.id !== wfId));
      setApplications((p) => p.filter((a) => a.workflow_id !== wfId));
      toast.success(`Deleted "${confirmDeleteWf.name}"`);
      setConfirmDeleteWf(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete workflow");
    } finally { setDeletingWf(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedAppIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
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
      const prof = profiles.find((p) => p.id === a.user_id);
      if (facultyFilter !== "all" && prof?.faculty !== facultyFilter) return false;
      if (departmentFilter !== "all" && prof?.department !== departmentFilter) return false;
      if (reviewerFilter !== "all") {
        if (reviewerFilter === "unassigned" ? !!a.reviewer_id : a.reviewer_id !== reviewerFilter) return false;
      }
      if (dateFrom) {
        const ref = a.submitted_at || a.created_at;
        if (!ref || new Date(ref) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const ref = a.submitted_at || a.created_at;
        // include the whole "to" day
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (!ref || new Date(ref) > end) return false;
      }
      if (search) {
        const hay = `${prof?.full_name ?? ""} ${prof?.email ?? ""} ${prof?.student_number ?? ""} ${prof?.staff_number ?? ""} ${wf?.name ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, workflows, profiles, audienceTab, statusFilter, workflowFilter, facultyFilter, departmentFilter, reviewerFilter, dateFrom, dateTo, search]);

  const departmentOptions = facultyFilter === "all"
    ? Array.from(new Set(Object.values(UFH_FACULTIES).flat()))
    : (UFH_FACULTIES[facultyFilter] ?? []);

  const filtersActive = !!(search || statusFilter !== "all" || workflowFilter !== "all" || facultyFilter !== "all" || departmentFilter !== "all" || reviewerFilter !== "all" || dateFrom || dateTo);

  const studentCount = applications.filter((a) => {
    const wf = workflows.find((w) => w.id === a.workflow_id);
    return wf?.target_role === "student" || wf?.target_role === "any";
  }).length;
  const staffCount = applications.filter((a) => {
    const wf = workflows.find((w) => w.id === a.workflow_id);
    return wf?.target_role === "staff" || wf?.target_role === "any";
  }).length;

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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulletinOpen(true)}>
              <FileSearch className="w-3.5 h-3.5 mr-1 text-accent" /> Extract from Daily Bulletin
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1 text-accent" /> AI workflow
            </Button>
            <Link to="/admin/audit"><Button size="sm" variant="outline"><History className="w-3.5 h-3.5 mr-1" /> Audit trail</Button></Link>
          </div>
        </div>

        <AIWorkflowDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onCreated={(wf) => { setWorkflows((p) => [wf, ...p]); setEditingWf(wf.id); setTab("workflows"); }}
        />

        <BulletinExtractor
          open={bulletinOpen}
          onClose={() => setBulletinOpen(false)}
          onCreated={() => {
            supabase.from("workflows").select("*").order("created_at", { ascending: false })
              .then(({ data }) => setWorkflows(data ?? []));
          }}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
            <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
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
              <CardContent className="p-3 grid gap-2 md:grid-cols-12 items-end">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search name, email, student #…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-7 gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
                      <SelectItem value="changes_requested">Changes requested</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Workflow" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All workflows</SelectItem>
                      {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={facultyFilter} onValueChange={(v) => { setFacultyFilter(v); setDepartmentFilter("all"); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Faculty" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All faculties</SelectItem>
                      {UFH_FACULTY_NAMES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All departments</SelectItem>
                      {departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Reviewer" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All reviewers</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col">
                    <Label className="text-[10px] text-muted-foreground mb-1">From</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] text-muted-foreground mb-1">To</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
                  </div>
                  {filtersActive && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={() => {
                      setSearch(""); setStatusFilter("all"); setWorkflowFilter("all");
                      setFacultyFilter("all"); setDepartmentFilter("all");
                      setDateFrom(""); setDateTo("");
                    }}>Clear</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{filteredApps.length} {filteredApps.length === 1 ? "result" : "results"}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {filteredApps.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const ids = filteredApps.map((a) => a.id);
                      const allSelected = ids.every((id) => selectedAppIds.includes(id));
                      setSelectedAppIds(allSelected ? selectedAppIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedAppIds, ...ids])));
                    }}>
                      {filteredApps.every((a) => selectedAppIds.includes(a.id)) ? "Clear selection" : "Select all"}
                    </Button>
                  )}
                  {selectedAppIds.length > 0 && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete({ ids: selectedAppIds })}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete {selectedAppIds.length}
                    </Button>
                  )}
                  <Button
                    variant={aiRankOn ? "default" : "outline"}
                    size="sm"
                    disabled={computingRank}
                    onClick={async () => {
                      if (aiRankOn) { setAiRankOn(false); return; }
                      setComputingRank(true);
                      try {
                        // Pull required + uploaded docs for scoring
                        const wfIds = Array.from(new Set(filteredApps.map((a) => a.workflow_id)));
                        const appIds = filteredApps.map((a) => a.id);
                        const [reqRes, upRes] = await Promise.all([
                          wfIds.length ? supabase.from("workflow_documents").select("id,workflow_id,required").in("workflow_id", wfIds) : Promise.resolve({ data: [] as any[] }),
                          appIds.length ? supabase.from("application_documents").select("application_id,document_id").in("application_id", appIds) : Promise.resolve({ data: [] as any[] }),
                        ]);
                        const required: Record<string, string[]> = {};
                        ((reqRes as any).data ?? []).forEach((r: any) => {
                          if (!r.required) return;
                          (required[r.workflow_id] ??= []).push(r.id);
                        });
                        const uploaded: Record<string, string[]> = {};
                        ((upRes as any).data ?? []).forEach((u: any) => {
                          if (!u.document_id) return;
                          (uploaded[u.application_id] ??= []).push(u.document_id);
                        });
                        const ranked = rankApplications({
                          applications: filteredApps,
                          profiles,
                          workflows,
                          uploadedDocs: uploaded,
                          requiredDocs: required,
                        });
                        const map: Record<string, RankedApplication> = {};
                        ranked.forEach((r) => { map[r.id] = r; });
                        setRankings(map);
                        setAiRankOn(true);
                        toast.success(`Ranked ${ranked.length} applicants`);
                      } catch (e: any) {
                        toast.error(e?.message ?? "Ranking failed");
                      } finally { setComputingRank(false); }
                    }}
                  >
                    {computingRank ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5 text-accent" />}
                    {aiRankOn ? "AI ranking on" : "Sort by AI Ranking"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredApps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No applications match these filters.</p>
                ) : (
                  <div className="space-y-3">
                     {(aiRankOn
                        ? [...filteredApps].sort((x, y) => (rankings[y.id]?.score ?? 0) - (rankings[x.id]?.score ?? 0))
                        : filteredApps
                      ).map((a) => {
                       const wf = workflows.find((w) => w.id === a.workflow_id);
                       const prof = profiles.find((p) => p.id === a.user_id);
                       const reviewer = admins.find((x) => x.id === a.reviewer_id);
                       const rank = rankings[a.id];
                       return (
                         <div
                           key={a.id}
                           role="button"
                           tabIndex={0}
                           onClick={() => setViewingApp(a.id)}
                           onKeyDown={(e) => { if (e.key === "Enter") setViewingApp(a.id); }}
                           className="flex items-center justify-between p-3 border rounded-lg gap-3 flex-wrap cursor-pointer hover:bg-muted/40 hover:border-primary/40 transition"
                         >
                           <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                             <Checkbox
                               checked={selectedAppIds.includes(a.id)}
                               onCheckedChange={() => toggleSelect(a.id)}
                               aria-label="Select application"
                             />
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="font-medium text-sm">
                               {aiRankOn && rank && <Badge className="mr-2 text-[10px]">#{rank.rank}</Badge>}
                               {prof?.full_name || prof?.email || "Unknown"}
                               <span className="text-muted-foreground font-normal"> — {wf?.name}</span>
                               {wf?.target_role === "staff" && <Badge variant="outline" className="ml-2 text-[10px]">Staff</Badge>}
                               {wf?.target_role === "student" && <Badge variant="outline" className="ml-2 text-[10px]">Student</Badge>}
                             </p>
                             <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                               <span>{prof?.faculty} · {prof?.department}</span>
                               {reviewer ? (
                                 <span className="inline-flex items-center gap-1 text-primary"><UserCheck className="w-3 h-3" /> {reviewer.full_name || reviewer.email}</span>
                               ) : (
                                 <span className="italic">Unassigned</span>
                               )}
                             </p>
                           </div>
                           {aiRankOn && rank && (
                             <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                               <Sparkles className="w-3 h-3 mr-1" /> {rank.score}% match
                             </Badge>
                           )}
                           <Badge className={`status-${a.status.replace("_","-")} capitalize`}>{a.status.replace("_"," ")}</Badge>
                           <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                             {aiRankOn && rank && (
                               <Button size="sm" variant="outline" onClick={() => setExplainRank({ id: a.id })} title="Explain ranking">
                                 <Sparkles className="w-3.5 h-3.5 text-accent" />
                               </Button>
                             )}
                             <Button size="sm" variant="outline" onClick={() => setViewingApp(a.id)}><Eye className="w-3.5 h-3.5" /></Button>
                             <Button size="sm" variant="outline" className="text-success" onClick={() => quickApprove(a.id)}><Check className="w-3.5 h-3.5" /></Button>
                             <Button size="sm" variant="outline" className="text-destructive" onClick={() => setViewingApp(a.id)} title="Open to add a rejection reason"><X className="w-3.5 h-3.5" /></Button>
                             <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete({ ids: [a.id] })} title="Delete application"><Trash2 className="w-3.5 h-3.5" /></Button>
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
                      <div className="flex items-center justify-between">
                        <Label>Description</Label>
                        <Button type="button" size="sm" variant="ghost" onClick={async () => {
                          if (!newWf.name) return toast.info("Add a name first");
                          try {
                            const { generateSuggestion } = await import("@/lib/ai");
                            const res = await generateSuggestion(
                              { label: "Workflow description", type: "textarea" },
                              null,
                              { name: newWf.name, description: newWf.description }
                            );
                            setNewWf((p) => ({ ...p, description: res.text }));
                          } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
                        }}>
                          <Sparkles className="w-3 h-3 mr-1 text-accent" /> AI assist
                        </Button>
                      </div>
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
                <Card
                  key={w.id}
                  className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition"
                  onClick={() => setEditingWf(w.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingWf(w.id); }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="font-semibold">{w.name}</h3>
                      <Badge variant={w.is_active ? "default" : "outline"}>{w.is_active ? "Active" : "Draft"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{w.description}</p>
                    <p className="text-xs text-muted-foreground">/{w.slug}</p>
                     <div className="flex items-center justify-between mt-3 flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                       <p className="text-xs text-muted-foreground">
                         {applications.filter((a) => a.workflow_id === w.id).length} applications
                       </p>
                       <div className="flex gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                         <Button
                           size="sm"
                           variant={w.is_active ? "outline" : "default"}
                           className={w.is_active ? "" : "btn-gradient-primary text-primary-foreground"}
                           onClick={async () => {
                             const next = !w.is_active;
                             const { error } = await supabase.from("workflows").update({ is_active: next }).eq("id", w.id);
                             if (error) return toast.error(error.message);
                             setWorkflows((p) => p.map((x) => x.id === w.id ? { ...x, is_active: next } : x));
                             toast.success(next ? "Published" : "Unpublished");
                           }}
                           title={w.is_active ? "Unpublish workflow" : "Publish workflow"}
                         >
                           {w.is_active ? "Unpublish" : "Publish"}
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => setTemplatesFor({ id: w.id, name: w.name })}>
                           <Stamp className="w-3.5 h-3.5 mr-1" /> Offer templates
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => setEditingWf(w.id)}>
                           <Settings2 className="w-3.5 h-3.5 mr-1" /> Edit
                         </Button>
                         <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDeleteWf({ id: w.id, name: w.name })} title="Delete workflow">
                           <Trash2 className="w-3.5 h-3.5" />
                         </Button>
                       </div>
                     </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* External opportunity drafts/published from the bulletin */}
            {externalOpps.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-accent" /> External opportunities ({externalOpps.length})
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {externalOpps.map((e) => (
                    <Card key={e.id} className="border-dashed">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h4 className="font-semibold leading-tight">{e.title}</h4>
                          <Badge variant={e.status === "published" ? "default" : "outline"}>{e.status}</Badge>
                        </div>
                        {e.organization && <p className="text-xs text-muted-foreground mb-1">{e.organization}</p>}
                        <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{e.description}</p>
                        {e.external_link && (
                          <a href={e.external_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mb-3">
                            <ExternalLink className="w-3 h-3" /> {new URL(e.external_link).host}
                          </a>
                        )}
                        <div className="flex gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant={e.status === "published" ? "outline" : "default"}
                            className={e.status === "published" ? "" : "btn-gradient-primary text-primary-foreground"}
                            onClick={async () => {
                              const next = e.status === "published" ? "draft" : "published";
                              const { error } = await supabase.from("external_opportunities" as any).update({ status: next }).eq("id", e.id);
                              if (error) return toast.error(error.message);
                              setExternalOpps((p) => p.map((x) => x.id === e.id ? { ...x, status: next } : x));
                              toast.success(next === "published" ? "Published" : "Unpublished");
                            }}
                          >
                            {e.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={async () => {
                              if (!confirm(`Delete external opportunity "${e.title}"?`)) return;
                              const { error } = await supabase.from("external_opportunities" as any).delete().eq("id", e.id);
                              if (error) return toast.error(error.message);
                              setExternalOpps((p) => p.filter((x) => x.id !== e.id));
                              toast.success("Deleted");
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="access">
            <AdminManagement />
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
        {templatesFor && (
          <OfferTemplateManager
            workflowId={templatesFor.id}
            workflowName={templatesFor.name}
            onClose={() => setTemplatesFor(null)}
          />
        )}

        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {confirmDelete?.ids.length} application{confirmDelete && confirmDelete.ids.length === 1 ? "" : "s"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the selected application{confirmDelete && confirmDelete.ids.length === 1 ? "" : "s"}, including responses, uploaded documents, offers, affidavits and messages. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!confirmDeleteWf} onOpenChange={(o) => !o && setConfirmDeleteWf(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete workflow "{confirmDeleteWf?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the workflow along with all of its steps, fields, required documents, eligibility rules, offer templates, and every application submitted to it (including responses, uploads, offers, affidavits and messages). This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingWf}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runDeleteWorkflow} disabled={deletingWf} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deletingWf ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete workflow"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <RankingExplainer
          open={!!explainRank}
          onClose={() => setExplainRank(null)}
          ranked={explainRank ? rankings[explainRank.id] ?? null : null}
          applicantName={(() => {
            const a = applications.find((x) => x.id === explainRank?.id);
            const p = profiles.find((pp) => pp.id === a?.user_id);
            return p?.full_name || p?.email || "Applicant";
          })()}
          workflowName={(() => {
            const a = applications.find((x) => x.id === explainRank?.id);
            return workflows.find((w) => w.id === a?.workflow_id)?.name ?? "";
          })()}
        />
      </main>
    </div>
  );
};

export default Admin;