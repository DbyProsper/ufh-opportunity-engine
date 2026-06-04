import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Upload, ExternalLink, FileText, Trash2, Pencil, Check, AlertCircle } from "lucide-react";
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

export const BulletinExtractor = ({ open, onClose, onCreated }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const reset = () => { setFile(null); setOpps([]); setEditingIdx(null); };

  const analyse = async () => {
    if (!file) return toast.error("Choose a PDF first");
    if (file.type !== "application/pdf") return toast.error("Only PDF files are supported");
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20 MB");
    setBusy(true);
    setOpps([]);
    try {
      const pdfBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-bulletin", {
        body: { pdfBase64, mime: file.type },
      });
      if (error) throw error;
      const list = ((data as any)?.opportunities ?? []) as Opp[];
      if (!list.length) {
        toast.warning("No opportunities found. Try a different bulletin.");
      } else {
        toast.success(`Extracted ${list.length} opportunit${list.length === 1 ? "y" : "ies"}`);
      }
      setOpps(list.map((o) => ({ ...o, _state: "pending" })));
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally { setBusy(false); }
  };

  const saveOne = async (i: number) => {
    const o = opps[i];
    if (!o) return;
    setSavingIdx(i);
    try {
      if (o.type === "external") {
        const { error } = await supabase.from("external_opportunities" as any).insert({
          title: o.title,
          organization: o.organization,
          description: o.description,
          requirements: o.requirements,
          deadline: o.deadline || null,
          external_link: o.external_link,
          confidence: o.confidence,
          status: "draft",
        });
        if (error) throw error;
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
        // Force draft
        await supabase.from("workflows").update({ is_active: false }).eq("id", wf.id);
      }
      setOpps((p) => p.map((x, j) => j === i ? { ...x, _state: "saved" } : x));
      toast.success(`Saved "${o.title}" as draft`);
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
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> {file.name} ({Math.round(file.size/1024)} KB)</p>}
            </div>
            <Button onClick={analyse} disabled={!file || busy} className="btn-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Analyze Bulletin
            </Button>
          </div>

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
                    <>
                      <TableRow key={i} className={o._state === "discarded" ? "opacity-40" : ""}>
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
                        <TableRow key={`${i}-edit`}>
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
                    </>
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