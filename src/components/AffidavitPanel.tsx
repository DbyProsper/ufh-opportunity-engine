import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Download, FileText, Loader2, Stamp, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string;
  applicantId: string;
  isAdmin?: boolean;
}

/**
 * Hybrid affidavit workflow:
 *  1. Generate pre-filled PDF
 *  2. Applicant prints, signs and gets stamped at police station
 *  3. Applicant uploads scanned signed copy
 *  4. Admin verifies or rejects with notes
 */
export const AffidavitPanel = ({ applicationId, applicantId, isAdmin = false }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("affidavit_submissions").select("*").eq("application_id", applicationId).maybeSingle();
    setRow(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [applicationId]);

  const generate = async () => {
    setBusy("generate");
    try {
      const { data, error } = await supabase.functions.invoke("generate-ufh-pdf", {
        body: { applicationId, kind: "affidavit_blank" },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No URL");
      window.open(url, "_blank");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to generate"); }
    finally { setBusy(null); }
  };

  const upload = async (file: File) => {
    if (!user) return;
    setBusy("upload");
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const path = `${user.id}/${applicationId}/affidavit-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("affidavits").upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) throw up.error;
      if (row) {
        await supabase.from("affidavit_submissions").update({
          status: "uploaded", uploaded_path: path, uploaded_file_name: file.name, uploaded_at: new Date().toISOString(),
        }).eq("id", row.id);
      } else {
        await supabase.from("affidavit_submissions").insert({
          application_id: applicationId, user_id: user.id,
          status: "uploaded", uploaded_path: path, uploaded_file_name: file.name, uploaded_at: new Date().toISOString(),
        } as never);
      }
      toast.success("Signed affidavit uploaded for review");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setBusy(null); }
  };

  const viewSigned = async () => {
    if (!row?.uploaded_path) return;
    const { data } = await supabase.storage.from("affidavits").createSignedUrl(row.uploaded_path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const verify = async () => {
    setBusy("verify");
    await supabase.from("affidavit_submissions").update({
      status: "verified", verified_by: user!.id, verified_at: new Date().toISOString(), admin_notes: null,
    }).eq("id", row.id);
    setBusy(null); await load();
  };
  const reject = async () => {
    if (!notes.trim()) { toast.error("Please provide a reason"); return; }
    setBusy("reject");
    await supabase.from("affidavit_submissions").update({
      status: "rejected", admin_notes: notes.trim(), verified_by: user!.id, verified_at: new Date().toISOString(),
    }).eq("id", row.id);
    setBusy(null); setShowReject(false); setNotes(""); await load();
  };

  if (loading) return <Card><CardContent className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></CardContent></Card>;

  const status = row?.status ?? "pending";
  const badge =
    status === "verified" ? <Badge className="bg-success text-success-foreground">Verified</Badge> :
    status === "uploaded" ? <Badge className="bg-info text-info-foreground">Awaiting verification</Badge> :
    status === "rejected" ? <Badge variant="destructive">Rejected</Badge> :
    status === "generated" ? <Badge variant="secondary">Awaiting your upload</Badge> :
    <Badge variant="outline">Not started</Badge>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2"><Stamp className="w-4 h-4" /> Affidavit</CardTitle>
        {badge}
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "rejected" && row?.admin_notes && (
          <div className="text-sm p-3 border border-destructive/30 bg-destructive/5 rounded">
            <p className="font-medium text-destructive mb-1">Reviewer notes</p>
            <p className="whitespace-pre-wrap">{row.admin_notes}</p>
          </div>
        )}

        {!isAdmin && (
          <>
            <p className="text-sm text-muted-foreground">
              Step 1: Download the pre-filled affidavit. Step 2: Sign it and have it stamped at a police station / commissioner of oaths.
              Step 3: Scan and upload the signed copy below.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={generate} disabled={!!busy}>
                {busy === "generate" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                Download affidavit
              </Button>
              {(status === "generated" || status === "rejected" || status === "uploaded") && (
                <label>
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted cursor-pointer">
                    {busy === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {status === "uploaded" || status === "rejected" ? "Re-upload signed copy" : "Upload signed copy"}
                  </span>
                </label>
              )}
              {row?.uploaded_path && (
                <Button size="sm" variant="ghost" onClick={viewSigned}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> View uploaded copy
                </Button>
              )}
            </div>
          </>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={viewSigned} disabled={!row?.uploaded_path}>
              <FileText className="w-3.5 h-3.5 mr-1" /> View signed copy
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90"
              onClick={verify} disabled={!row || row.status === "verified" || !!busy}>
              <Check className="w-3.5 h-3.5 mr-1" /> Verify
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowReject(true)} disabled={!row || !!busy}>
              <X className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}

        <Dialog open={showReject} onOpenChange={setShowReject}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject affidavit</DialogTitle></DialogHeader>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain what to fix..." rows={4} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
              <Button variant="destructive" onClick={reject} disabled={busy === "reject"}>
                {busy === "reject" && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};