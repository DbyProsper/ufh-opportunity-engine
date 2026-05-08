import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FileText, Upload, Download, Send, Check, X, RefreshCcw, Stamp } from "lucide-react";
import { toast } from "sonner";
import { EventTimeline, TimelineEvent } from "@/components/EventTimeline";
import { PreviewPackButton } from "@/pages/Apply";

interface Props {
  applicationId: string;
  workflowId: string;
  applicantId: string;
  isAdmin: boolean;
  onAfterChange?: () => void;
}

export const OfferPanel = ({ applicationId, workflowId, applicantId, isAdmin, onAfterChange }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [pickedTemplates, setPickedTemplates] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const [oR, tR] = await Promise.all([
      supabase.from("offers").select("*").eq("application_id", applicationId).maybeSingle(),
      supabase.from("workflow_offer_templates").select("*").eq("workflow_id", workflowId).order("created_at"),
    ]);
    setOffer(oR.data);
    setTemplates(tR.data ?? []);
    if (oR.data) {
      const [dR, eR] = await Promise.all([
        supabase.from("offer_documents").select("*").eq("offer_id", oR.data.id).order("created_at"),
        supabase.from("offer_events" as any).select("*").eq("offer_id", oR.data.id).order("created_at", { ascending: true }),
      ]);
      setDocs(dR.data ?? []);
      setEvents((eR.data as any[] ?? []) as TimelineEvent[]);
    } else {
      setDocs([]);
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId]);

  const openFile = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  };

  // ─── Admin actions ────────────────────────────────────────────────
  const sendOffer = async () => {
    if (pickedTemplates.length === 0) return toast.error("Pick at least one offer template");
    const chosen = templates.filter((t) => pickedTemplates.includes(t.id));
    if (chosen.length === 0) return;
    const primary = chosen[0];
    setUploading(true);
    const { data, error } = await supabase.from("offers").upsert({
      application_id: applicationId,
      template_id: primary.id,
      template_path: primary.file_path,
      template_name: primary.file_name,
      message: message || null,
      status: "template_sent" as any,
      sent_at: new Date().toISOString(),
      reviewer_id: user!.id,
    } as any, { onConflict: "application_id" }).select().single();
    if (error) { setUploading(false); return toast.error(error.message); }
    // Attach all chosen templates as offer_documents (kind='template') so applicant downloads everything at once.
    if (data) {
      const rows = chosen.map((t) => ({
        offer_id: (data as any).id,
        kind: "template",
        version: 1,
        file_path: t.file_path,
        file_name: t.file_name,
        bucket: "offer-templates",
        uploaded_by: user!.id,
        notes: t.name,
      }));
      await supabase.from("offer_documents").insert(rows as any);
    }
    setUploading(false);
    setShowSend(false);
    setMessage(""); setPickedTemplates([]);
    toast.success(`${chosen.length} offer ${chosen.length === 1 ? "template" : "templates"} sent to applicant`);
    setOffer(data);
    onAfterChange?.();
    load();
  };

  const requestRevision = async () => {
    if (!reason.trim()) return toast.error("A note is required so the applicant knows what to change");
    const { error } = await supabase.from("offers").update({
      status: "revision_requested" as any,
      rejection_reason: reason.trim(),
    } as any).eq("id", offer.id);
    if (error) return toast.error(error.message);
    setShowRevise(false); setReason("");
    toast.success("Revision requested");
    load();
  };

  const approveOffer = async () => {
    const { error } = await supabase.from("offers").update({
      status: "approved" as any,
      responded_at: new Date().toISOString(),
    } as any).eq("id", offer.id);
    if (error) return toast.error(error.message);
    toast.success("Offer approved");
    load();
  };

  const rejectOffer = async () => {
    if (!reason.trim()) return toast.error("Please add a reason");
    const { error } = await supabase.from("offers").update({
      status: "rejected" as any,
      rejection_reason: reason.trim(),
      responded_at: new Date().toISOString(),
    } as any).eq("id", offer.id);
    if (error) return toast.error(error.message);
    setShowReject(false); setReason("");
    toast.success("Offer rejected");
    load();
  };

  // ─── Applicant action: upload signed copy ───────────────────────
  const uploadSigned = async (file: File) => {
    if (!user || !offer) return;
    setUploading(true);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const nextVersion = (offer.current_version ?? 0) + 1;
    const path = `${user.id}/${offer.id}/v${nextVersion}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("offer-signed").upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("offer_documents").insert({
      offer_id: offer.id,
      kind: "signed",
      version: nextVersion,
      file_path: path,
      file_name: file.name,
      uploaded_by: user.id,
    } as any);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed copy uploaded — admin will be notified.");
    load();
  };

  if (loading) {
    return (
      <Card><CardContent className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></CardContent></Card>
    );
  }

  // No offer yet
  if (!offer) {
    if (!isAdmin) {
      return (
        <Card>
          <CardHeader><CardTitle className="text-base">Offer</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Your offer hasn't been issued yet. You'll be notified when it's ready.</p></CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Send offer</CardTitle>
          <Button size="sm" className="btn-gradient-primary text-primary-foreground" onClick={() => setShowSend(true)} disabled={templates.length === 0}>
            <Send className="w-3.5 h-3.5 mr-1" /> Send offer
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offer templates uploaded for this workflow yet. Add one in Workflow → Offer templates.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a template, the applicant will be asked to sign, stamp if required, and upload a signed copy.</p>
          )}
        </CardContent>
        <SendOfferDialog
          open={showSend} onClose={() => setShowSend(false)}
          templates={templates} pickedTemplates={pickedTemplates} setPickedTemplates={setPickedTemplates}
          message={message} setMessage={setMessage} onSend={sendOffer} sending={uploading}
        />
      </Card>
    );
  }

  const signedDocs = docs.filter((d) => d.kind === "signed").sort((a, b) => b.version - a.version);
  const templateDocs = docs.filter((d) => d.kind === "template");
  const latestSigned = signedDocs[0];
  const status = offer.status as string;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Stamp className="w-4 h-4 text-primary" /> Offer</CardTitle>
          <OfferBadge status={status} />
        </div>
        {isAdmin && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setShowSend(true)} disabled={templates.length === 0}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Resend template
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {offer.message && (
          <div className="text-sm bg-muted/40 border rounded p-3 whitespace-pre-wrap">{offer.message}</div>
        )}

        {/* Template */}
        {templateDocs.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Offer templates ({templateDocs.length})</p>
            <div className="space-y-2">
              {templateDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 border rounded-lg gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.notes || d.file_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{d.file_name}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openFile(d.bucket || "offer-templates", d.file_path)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : offer.template_path && (
          <div className="flex items-center justify-between p-3 border rounded-lg gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">Offer template</p>
                <p className="text-xs text-muted-foreground truncate">{offer.template_name}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openFile("offer-templates", offer.template_path)}>
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </div>
        )}

        {/* Signed history */}
        {signedDocs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Signed copies</p>
            <div className="space-y-2">
              {signedDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 border rounded-lg gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">v{d.version} · {d.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openFile("offer-signed", d.file_path)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(status === "revision_requested" || status === "rejected") && offer.rejection_reason && (
          <div className="text-sm border-l-4 border-destructive bg-destructive/5 p-3 rounded">
            <p className="font-medium mb-1">{status === "rejected" ? "Rejection reason" : "Revision requested"}</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{offer.rejection_reason}</p>
          </div>
        )}

        {/* Applicant: upload signed */}
        {!isAdmin && status !== "approved" && (
          <div>
            <p className="text-sm mb-2">
              {signedDocs.length === 0
                ? "Sign the template, get it stamped at the police station if required, then upload it below."
                : status === "revision_requested"
                  ? "Please upload a revised signed copy."
                  : "Awaiting admin review of your latest signed copy. You can upload a new version if needed."}
            </p>
            <label className={`flex items-center justify-center gap-2 w-full py-5 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])} />
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> <span className="text-sm">Upload signed copy</span></>}
            </label>
          </div>
        )}

        {/* Admin actions on signed copies */}
        {isAdmin && status !== "approved" && status !== "rejected" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <PreviewPackButton
              applicationId={applicationId}
              includeOfferSigned
              label="Preview with signed copy"
              title="Offer pack preview"
              signedCopyAvailable={!!latestSigned}
            />
            {latestSigned && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowRevise(true)}><RefreshCcw className="w-3.5 h-3.5 mr-1" /> Request revision</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setShowReject(true)}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
                <Button size="sm" className="btn-gradient-primary text-primary-foreground" onClick={approveOffer}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
              </>
            )}
            {!latestSigned && (
              <p className="text-xs text-muted-foreground self-center">Awaiting applicant to upload a signed copy before review actions become available.</p>
            )}
          </div>
        )}

        {events.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Audit timeline</p>
            <EventTimeline events={events} filterable />
          </div>
        )}
      </CardContent>

      <SendOfferDialog
        open={showSend} onClose={() => setShowSend(false)}
        templates={templates} pickedTemplates={pickedTemplates} setPickedTemplates={setPickedTemplates}
        message={message} setMessage={setMessage} onSend={sendOffer} sending={uploading}
      />

      <ReasonDialog
        open={showRevise} onClose={() => setShowRevise(false)}
        title="Request a revised copy"
        placeholder="Explain exactly what the applicant must correct on the signed copy. This note is required and will be shown to them."
        reason={reason} setReason={setReason} onSubmit={requestRevision} confirmLabel="Send request"
        required
      />
      <ReasonDialog
        open={showReject} onClose={() => setShowReject(false)}
        title="Reject offer" placeholder="Reason the offer is being rejected"
        reason={reason} setReason={setReason} onSubmit={rejectOffer} confirmLabel="Reject offer" destructive required
      />
    </Card>
  );
};

const OfferBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-muted text-foreground",
    sent: "bg-primary/15 text-primary",
    template_sent: "bg-primary/15 text-primary",
    signed_uploaded: "bg-warning/15 text-warning",
    revision_requested: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    accepted: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    declined: "bg-destructive/15 text-destructive",
    withdrawn: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = {
    template_sent: "Template sent",
    signed_uploaded: "Awaiting review",
    revision_requested: "Revision requested",
  };
  return <Badge className={`capitalize ${map[status] ?? "bg-muted text-foreground"}`}>{label[status] ?? status.replace(/_/g, " ")}</Badge>;
};

const SendOfferDialog = ({ open, onClose, templates, pickedTemplates, setPickedTemplates, message, setMessage, onSend, sending }: any) => {
  const toggle = (id: string) => {
    setPickedTemplates((prev: string[]) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const allIds = templates.map((t: any) => t.id);
  const allSelected = templates.length > 0 && pickedTemplates.length === templates.length;
  return (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Send offer</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Offer templates ({pickedTemplates.length} selected)</p>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setPickedTemplates(allSelected ? [] : allIds)}>
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </div>
          <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
            {templates.length === 0 && <p className="p-3 text-xs text-muted-foreground">No templates available.</p>}
            {templates.map((t: any) => (
              <label key={t.id} className="flex items-start gap-2 p-2.5 hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={pickedTemplates.includes(t.id)} onCheckedChange={() => toggle(t.id)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.file_name}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Applicant will receive and download all selected templates together.</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Message to applicant (optional)</p>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Sign all pages, get it stamped at SAPS, scan and upload here." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSend} disabled={sending || pickedTemplates.length === 0} className="btn-gradient-primary text-primary-foreground">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Send
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  );
};

const ReasonDialog = ({ open, onClose, title, placeholder, reason, setReason, onSubmit, confirmLabel, destructive, required }: any) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
      {required && <p className="text-xs text-muted-foreground">A note is required.</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} disabled={required && !reason.trim()} className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "btn-gradient-primary text-primary-foreground"}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);