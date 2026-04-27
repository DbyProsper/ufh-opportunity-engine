import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Check, Clock, Eye, FileText, Loader2, Mail, MessageSquare, Phone, User, X } from "lucide-react";
import { MessageThread } from "@/components/MessageThread";
import { useAuth } from "@/contexts/AuthContext";
import { PreviewPackButton } from "@/pages/Apply";

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
    const { error } = await supabase.from("applications").update({
      status: status as any, reviewed_at: new Date().toISOString(), review_notes: reviewNotes || null,
    }).eq("id", applicationId);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: `Application ${status.replace("_"," ")}`,
      body: `Your ${workflow?.name ?? "application"} status was updated.`,
      link: "/dashboard",
      type: status === "approved" ? "success" : status === "rejected" ? "error" : "info",
    });
    toast.success(`Marked ${status}`);
    onStatusChange(applicationId, status);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl"><div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></DialogContent>
      </Dialog>
    );
  }

  if (!app) return null;

  const timeline = [
    { label: "Created", at: app.created_at, icon: Clock },
    { label: "Submitted", at: app.submitted_at, icon: Check },
    { label: "Reviewed", at: app.reviewed_at, icon: Eye },
  ].filter((t) => t.at);

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

          <TabsContent value="timeline" className="mt-4">
            <ol className="relative border-l border-border pl-6 space-y-5">
              {timeline.map((t, i) => (
                <li key={i}>
                  <span className="absolute -left-[9px] flex w-4 h-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <t.icon className="w-2.5 h-2.5" />
                  </span>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(t.at!).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium">Review notes (visible to admins only)</p>
          <Textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add internal notes…" />
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <PreviewPackButton applicationId={applicationId} label="PDF pack" />
          <Button variant="outline" onClick={() => setStatus("under_review")}><Eye className="w-3.5 h-3.5 mr-1" /> Under review</Button>
          <Button variant="outline" className="text-destructive" onClick={() => setStatus("rejected")}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
          <Button className="btn-gradient-primary text-primary-foreground" onClick={() => setStatus("approved")}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
        </DialogFooter>
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