import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Eye, FileText, Loader2, Mail, MessageSquare, Phone, RefreshCcw, Stamp, User, UserCheck, X } from "lucide-react";
import { MessageThread } from "@/components/MessageThread";
import { useAuth } from "@/contexts/AuthContext";
import { PreviewPackButton } from "@/pages/Apply";
import { OfferPanel } from "@/components/OfferPanel";
import { EventTimeline, TimelineEvent } from "@/components/EventTimeline";

interface Props {
  applicationId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}

export const ApplicationDetail = ({ applicationId, onClose, onStatusChange }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [docMeta, setDocMeta] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  const [reasonOpen, setReasonOpen] = useState<null | "rejected" | "changes_requested">(null);
  const [reason, setReason] = useState("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    (async () => {
      const appR = await supabase.from("applications").select("*").eq("id", applicationId).maybeSingle();
      if (!appR.data) { setLoading(false); return; }
      setApp(appR.data);
      setReviewNotes(appR.data.review_notes ?? "");

      const [profR, wfR, dR, mR] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", appR.data.user_id).maybeSingle(),
        supabase.from("workflows").select("*").eq("id", appR.data.workflow_id).maybeSingle(),
        supabase.from("application_documents").select("*").eq("application_id", applicationId),
        supabase.from("application_responses").select("*").eq("application_id", applicationId),
      ]);
      setProfile(profR.data);
      setWorkflow(wfR.data);
      setDocs(dR.data ?? []);
      const map: Record<string, string> = {};
      (mR.data ?? []).forEach((r: any) => { map[r.field_id] = r.value ?? ""; });
      setResponses(map);

      const { data: evR } = await supabase
        .from("application_events" as any)
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true });
      setEvents((evR as any[] ?? []) as TimelineEvent[]);

      // Load admin reviewers (everyone with admin role)
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (adminRoles ?? []).map((r: any) => r.user_id);
      if (ids.length > 0) {
        const { data: ap } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        setAdmins(ap ?? []);
      }

      if (wfR.data) {
        const [sR, fR, dmR] = await Promise.all([
          supabase.from("workflow_steps").select("*").eq("workflow_id", wfR.data.id).order("step_order"),
          supabase.from("workflow_fields").select("*").eq("workflow_id", wfR.data.id).order("field_order"),
          supabase.from("workflow_documents").select("*").eq("workflow_id", wfR.data.id),
        ]);
        setSteps(sR.data ?? []);
        setFields(fR.data ?? []);
        setDocMeta(dmR.data ?? []);
      }
      setLoading(false);
    })();
  }, [applicationId]);

  const viewDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("application-documents").createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  };

  const setStatus = async (status: string) => {
    if (status === "rejected" || status === "changes_requested") {
      setReasonOpen(status as any); return;
    }
    const payload: any = { status, reviewed_at: new Date().toISOString(), review_notes: reviewNotes || null };
    if (status === "approved") payload.is_editable = false;
    const { error } = await supabase.from("applications").update(payload).eq("id", applicationId);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: `Application ${status.replace("_"," ")}`,
      body: `Your ${workflow?.name ?? "application"} status was updated.`,
      link: "/dashboard",
      type: status === "approved" ? "success" : "info",
    });
    toast.success(`Marked ${status}`);
    onStatusChange(applicationId, status);
    onClose();
  };

  const submitReason = async () => {
    if (!reason.trim()) return toast.error("Please add a reason");
    const status = reasonOpen!;
    const payload: any = {
      status,
      rejection_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    };
    if (status === "changes_requested") payload.is_editable = true;
    const { error } = await supabase.from("applications").update(payload).eq("id", applicationId);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: status === "rejected" ? "Application rejected" : "Changes requested on your application",
      body: reason.trim(),
      link: "/dashboard",
      type: status === "rejected" ? "error" : "warning",
    });
    toast.success(status === "rejected" ? "Rejected" : "Applicant can now edit");
    onStatusChange(applicationId, status);
    setReasonOpen(null); setReason("");
    onClose();
  };

  const assignReviewer = async (reviewerId: string) => {
    const value = reviewerId === "none" ? null : reviewerId;
    const { error } = await supabase.from("applications").update({ reviewer_id: value } as any).eq("id", applicationId);
    if (error) return toast.error(error.message);
    setApp((a: any) => ({ ...a, reviewer_id: value }));
    toast.success(value ? "Reviewer assigned" : "Reviewer cleared");
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl"><div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></DialogContent>
      </Dialog>
    );
  }

  if (!app) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {profile?.full_name || profile?.email || "Application"}
            <span className="text-muted-foreground text-sm font-normal">— {workflow?.name}</span>
            <Badge className={`status-${app.status.replace("_","-")} capitalize`}>{app.status.replace("_"," ")}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="responses">
          <TabsList>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="profile">Applicant</TabsTrigger>
            <TabsTrigger value="docs">Documents ({docs.length})</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="w-3.5 h-3.5 mr-1" /> Messages</TabsTrigger>
            <TabsTrigger value="offer"><Stamp className="w-3.5 h-3.5 mr-1" /> Offer</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="responses" className="mt-4 space-y-4">
            {steps.map((s) => {
              const sf = fields.filter((f) => f.step_id === s.id).sort((a, b) => a.field_order - b.field_order);
              if (sf.length === 0) return null;
              return (
                <div key={s.id}>
                  <h3 className="font-semibold mb-2 text-sm">{s.title}</h3>
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30 text-sm">
                    {sf.map((f) => (
                      <div key={f.id} className="flex flex-col sm:flex-row sm:gap-3 border-b last:border-b-0 pb-2 last:pb-0">
                        <p className="text-muted-foreground sm:w-1/3 text-xs">{f.label}</p>
                        <p className="font-medium flex-1 break-words">
                          {responses[f.id] || <span className="text-muted-foreground italic">No answer</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No form fields configured.</p>}
          </TabsContent>

          <TabsContent value="profile" className="mt-4">
            <div className="grid sm:grid-cols-2 gap-3 p-4 border rounded-lg text-sm">
              <Info icon={User} label="Full name" value={profile?.full_name} />
              <Info icon={Mail} label="Email" value={profile?.email} />
              <Info icon={Phone} label="Phone" value={profile?.phone} />
              <Info label="Student #" value={profile?.student_number} />
              <Info label="Staff #" value={profile?.staff_number} />
              <Info label="Faculty" value={profile?.faculty} />
              <Info label="Department" value={profile?.department} />
              <Info label="Qualification" value={profile?.qualification} />
              <Info label="Year of study" value={profile?.year_of_study} />
              <Info label="Address" value={profile?.address} />
              {profile?.bio && <div className="sm:col-span-2"><Info label="Bio" value={profile.bio} /></div>}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-2">
            {docs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded.</p>}
            {docs.map((d) => {
              const meta = docMeta.find((m) => m.id === d.document_id);
              return (
                <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{meta?.name || d.file_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.file_name}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => viewDoc(d.file_path)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Open
                  </Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            {user && app && (
              <MessageThread applicationId={app.id} applicantId={app.user_id} />
            )}
          </TabsContent>

          <TabsContent value="offer" className="mt-4">
            {app && (
              <OfferPanel
                applicationId={app.id}
                workflowId={app.workflow_id}
                applicantId={app.user_id}
                isAdmin
              />
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <EventTimeline events={events} empty="No events recorded yet." />
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-xs font-medium flex items-center gap-1 sm:w-40"><UserCheck className="w-3.5 h-3.5" /> Assigned reviewer</p>
            <Select value={app.reviewer_id ?? "none"} onValueChange={assignReviewer}>
              <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">Unassigned</SelectItem>
                {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">Review notes (visible to admins only)</p>
            <Textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add internal notes…" />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <PreviewPackButton applicationId={applicationId} label="PDF pack" />
          <Button variant="outline" onClick={() => setStatus("under_review")}><Eye className="w-3.5 h-3.5 mr-1" /> Under review</Button>
          <Button variant="outline" onClick={() => setStatus("changes_requested")}><RefreshCcw className="w-3.5 h-3.5 mr-1" /> Allow edits</Button>
          <Button variant="outline" className="text-destructive" onClick={() => setStatus("rejected")}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
          <Button className="btn-gradient-primary text-primary-foreground" onClick={() => setStatus("approved")}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
        </DialogFooter>

        <Dialog open={reasonOpen !== null} onOpenChange={(o) => !o && setReasonOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{reasonOpen === "rejected" ? "Reason for rejection" : "What should the applicant fix?"}</DialogTitle>
            </DialogHeader>
            <Textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonOpen === "rejected" ? "Explain why this application is being rejected." : "Tell the applicant exactly what to update so they can resubmit."} />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReasonOpen(null); setReason(""); }}>Cancel</Button>
              <Button onClick={submitReason} className={reasonOpen === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "btn-gradient-primary text-primary-foreground"}>
                {reasonOpen === "rejected" ? "Reject" : "Send back for edits"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

const Info = ({ icon: Icon, label, value }: { icon?: any; label: string; value?: string | null }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </p>
    <p className="font-medium break-words">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
  </div>
);