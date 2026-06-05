import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Upload, ExternalLink, FileText, Trash2, Pencil, Check, AlertCircle, RotateCcw, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface Opp {
  title: string;
  organization: string;
  description: string;
  requirements: string;
  deadline: string | null;
  external_link: string;
  type: "internal" | "external";
  confidence: number;
  eligibility_hints?: { rule_type: string; rule_value: string }[];
  _state?: "pending" | "saved" | "discarded";
}

interface Props { open: boolean; onClose: () => void; onCreated?: () => void; }

const fileToBase64 = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const hashString = async (s: string) => {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const BulletinExtractor = ({ open, onClose, onCreated }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfHash, setPdfHash] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [priorRuns, setPriorRuns] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [allRuns, setAllRuns] = useState<any[]>([]);

  const reset = () => { setFile(null); setOpps([]); setEditingIdx(null); setPdfBase64(null); setPdfHash(null); setRunId(null); setPriorRuns([]); };

  useEffect(() => {
    if (!open) return;
    supabase.from("bulletin_runs" as any).select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setAllRuns((data as any) ?? []));
  }, [open]);

  const analyse = async () => {
    let b64 = pdfBase64;
    let hash = pdfHash;
    let fname = file?.name;
    if (!b64) {
      if (!file) return toast.error("Choose a PDF first");
      if (file.type !== "application/pdf") return toast.error("Only PDF files are supported");
      if (file.size > 20 * 1024 * 1024) return toast.error("Max 20 MB");
      b64 = await fileToBase64(file);
      hash = await hashString(b64);
      setPdfBase64(b64); setPdfHash(hash);
      // load prior runs for same hash so the admin can compare
      const { data: prior } = await supabase.from("bulletin_runs" as any)
        .select("*").eq("file_hash", hash).order("created_at", { ascending: false });
      setPriorRuns((prior as any) ?? []);
    }
    setBusy(true);
    setOpps([]);
    try {
      const { data, error } = await supabase.functions.invoke("extract-bulletin", {
        body: { pdfBase64: b64, mime: "application/pdf", fileName: fname, fileHash: hash },
      });
      if (error) throw error;
      const list = ((data as any)?.opportunities ?? []) as Opp[];
      setRunId((data as any)?.run_id ?? null);
      if (!list.length) {
        toast.warning("No opportunities found. Try a different bulletin.");
      } else {
        toast.success(`Extracted ${list.length} opportunit${list.length === 1 ? "y" : "ies"}`);
      }
      setOpps(list.map((o) => ({ ...o, _state: "pending" })));
      // refresh runs list
      supabase.from("bulletin_runs" as any).select("*").order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => setAllRuns((data as any) ?? []));
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally { setBusy(false); }
  };

  // Diff with most recent prior run (other than the current one)
  const diff = (() => {
    const prev = priorRuns.find((r) => r.id !== runId);
    if (!prev) return null;
    const prevTitles = new Set(((prev.opportunities as Opp[]) ?? []).map((o) => o.title.toLowerCase()));
    const currTitles = new Set(opps.map((o) => o.title.toLowerCase()));
    const added = [...currTitles].filter((t) => !prevTitles.has(t));
    const removed = [...prevTitles].filter((t) => !currTitles.has(t));
    return { added, removed, prev };
  })();

  const saveOne = async (i: number) => {
    const o = opps[i];
    if (!o) return;
    setSavingIdx(i);
    let createdId: string | null = null;
    let createdKind: "external" | "internal" = o.type;
    try {
      if (o.type === "external") {
        const { data: ins, error } = await supabase.from("external_opportunities" as any).insert({
          title: o.title,
          organization: o.organization,
          description: o.description,
          requirements: o.requirements,
          deadline: o.deadline || null,
          external_link: o.external_link,
          confidence: o.confidence,
          status: "draft",
        }).select().single();
        if (error) throw error;
        createdId = (ins as any)?.id ?? null;
      } else {
        // Build a workflow from the opportunity via the AI generator
        const prompt = `Create an application workflow for: ${o.title}.
Organization: ${o.organization || "University of Fort Hare"}
Description: ${o.description}
Requirements: ${o.requirements}
${o.deadline ? `Deadline: ${o.deadline}` : ""}
Include the standard personal/identity/academic/address fields plus any extra steps the requirements imply.`;
        const { data, error } = await supabase.functions.invoke("generate-workflow", {
          body: {
            prompt,
            overrides: {
              target_role: "student",
              deadline: o.deadline || undefined,
              is_active: false,
            },
          },
        });
        if (error) throw error;
        const wf = (data as any)?.workflow;
        if (!wf) throw new Error("Workflow not created");
        createdId = wf.id;
        // Force draft
        await supabase.from("workflows").update({ is_active: false }).eq("id", wf.id);
        // Add eligibility rule hints from extractor
        if (o.eligibility_hints?.length) {
          const rows = o.eligibility_hints.map((h) => ({
            workflow_id: wf.id, rule_type: h.rule_type, rule_value: h.rule_value,
          }));
          await supabase.from("eligibility_rules").insert(rows as any);
        }
      }
      setOpps((p) => p.map((x, j) => j === i ? { ...x, _state: "saved" } : x));
      toast.success(`Saved "${o.title}" as draft`);

      // Append the created draft id to the bulletin_runs row for traceability
      if (runId && createdId) {
        const { data: row } = await supabase.from("bulletin_runs" as any).select("drafts_created").eq("id", runId).maybeSingle();
        const drafts = ((row as any)?.drafts_created ?? []) as any[];
        drafts.push({ id: createdId, type: createdKind, title: o.title, created_at: new Date().toISOString() });
        await supabase.from("bulletin_runs" as any).update({ drafts_created: drafts }).eq("id", runId);
      }
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally { setSavingIdx(null); }
  };

  const discard = (i: number) =>
    setOpps((p) => p.map((x, j) => j === i ? { ...x, _state: "discarded" } : x));

  const updateOpp = (i: number, patch: Partial<Opp>) =>
    setOpps((p) => p.map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && (reset(), onClose())}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Extract from Daily Bulletin
          </DialogTitle>
          <DialogDescription>
            Upload a UFH daily bulletin PDF. The AI will detect opportunities, classify them as internal or external, and let you review before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/30 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Label className="text-xs">Bulletin PDF</Label>
              <Input type="file" accept="application/pdf" disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPdfBase64(null); setPdfHash(null); setRunId(null); setOpps([]); setPriorRuns([]);
                }} />
              {file && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> {file.name} ({Math.round(file.size/1024)} KB)</p>}
            </div>
            <Button onClick={analyse} disabled={!file || busy} className="btn-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Analyze Bulletin
            </Button>
            {pdfBase64 && (
              <Button onClick={analyse} disabled={busy} variant="outline" title="Re-run extraction on the same PDF">
                <RotateCcw className="w-4 h-4 mr-1" /> Re-run
              </Button>
            )}
            <Button onClick={() => setShowHistory((s) => !s)} variant="outline" size="sm">
              <History className="w-4 h-4 mr-1" /> {showHistory ? "Hide" : "Runs"} ({allRuns.length})
            </Button>
          </div>

          {showHistory && (
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto text-xs space-y-1.5 bg-muted/20">
              <p className="font-semibold mb-1">Audit log — bulletin extraction runs</p>
              {allRuns.length === 0 ? (
                <p className="text-muted-foreground italic">No previous runs.</p>
              ) : allRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 border-b last:border-0 pb-1">
                  <span className="truncate"><strong>{r.file_name}</strong> · {(r.opportunities ?? []).length} found · {(r.drafts_created ?? []).length} drafts</span>
                  <span className="text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()} · {r.uploader_email ?? "—"}</span>
                </div>
              ))}
            </div>
          )}

          {diff && (diff.added.length > 0 || diff.removed.length > 0) && (
            <div className="border rounded-lg p-3 bg-accent/5 border-accent/30 text-xs space-y-1">
              <p className="font-semibold">Comparison vs. previous run on this PDF ({new Date(diff.prev.created_at).toLocaleString()})</p>
              {diff.added.length > 0 && <p><span className="text-success font-semibold">+ Added:</span> {diff.added.join(", ")}</p>}
              {diff.removed.length > 0 && <p><span className="text-destructive font-semibold">− Removed:</span> {diff.removed.join(", ")}</p>}
            </div>
          )}

          {opps.length > 0 && (
            <>
              <div className="flex items-start gap-2 text-sm p-3 border border-warning/40 bg-warning/5 rounded-lg">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                <p>Please review extracted opportunities before publishing. AI extraction may require corrections. Created items start as drafts.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opps.map((o, i) => (
                    <Fragment key={i}>
                      <TableRow className={o._state === "discarded" ? "opacity-40" : ""}>
                        <TableCell className="font-medium max-w-md">
                          <div className="truncate">{o.title}</div>
                          {o.organization && <div className="text-[11px] text-muted-foreground truncate">{o.organization}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.type === "external" ? "outline" : "default"} className="capitalize">
                            {o.type === "external" ? <><ExternalLink className="w-3 h-3 mr-1" />External</> : "Internal"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={o.confidence >= 0.7 ? "text-success border-success/40" : o.confidence >= 0.4 ? "text-warning border-warning/40" : "text-destructive border-destructive/40"}>
                            {Math.round(o.confidence * 100)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {o._state === "saved" ? (
                            <Badge className="bg-success text-success-foreground"><Check className="w-3 h-3 mr-1" /> Saved</Badge>
                          ) : o._state === "discarded" ? (
                            <span className="text-xs text-muted-foreground">Discarded</span>
                          ) : (
                            <div className="flex gap-1.5 justify-end">
                              <Button size="sm" variant="outline" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => discard(i)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                              <Button size="sm" disabled={savingIdx === i} onClick={() => saveOne(i)} className="btn-gradient-primary text-primary-foreground">
                                {savingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create draft"}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {editingIdx === i && o._state !== "saved" && o._state !== "discarded" && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/30">
                            <div className="grid sm:grid-cols-2 gap-3 p-2">
                              <div className="space-y-1"><Label className="text-xs">Title</Label>
                                <Input value={o.title} onChange={(e) => updateOpp(i, { title: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-xs">Organisation</Label>
                                <Input value={o.organization} onChange={(e) => updateOpp(i, { organization: e.target.value })} /></div>
                              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Description</Label>
                                <Textarea rows={3} value={o.description} onChange={(e) => updateOpp(i, { description: e.target.value })} /></div>
                              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Requirements</Label>
                                <Textarea rows={2} value={o.requirements} onChange={(e) => updateOpp(i, { requirements: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-xs">External link (sets type)</Label>
                                <Input value={o.external_link} onChange={(e) => updateOpp(i, { external_link: e.target.value, type: e.target.value ? "external" : "internal" })} placeholder="https://…" /></div>
                              <div className="space-y-1"><Label className="text-xs">Deadline</Label>
                                <Input type="date" value={o.deadline ? new Date(o.deadline).toISOString().slice(0,10) : ""} onChange={(e) => updateOpp(i, { deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={busy}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulletinExtractor;