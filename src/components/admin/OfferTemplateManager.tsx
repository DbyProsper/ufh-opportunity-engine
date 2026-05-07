import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}

export const OfferTemplateManager = ({ workflowId, workflowName, onClose }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase.from("workflow_offer_templates").select("*").eq("workflow_id", workflowId).order("created_at");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workflowId]);

  const upload = async () => {
    if (!file || !name.trim() || !user) return toast.error("Pick a file and name");
    setUploading(true);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${workflowId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("offer-templates").upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("workflow_offer_templates").insert({
      workflow_id: workflowId,
      name: name.trim(),
      description: description.trim() || null,
      file_path: path,
      file_name: file.name,
      uploaded_by: user.id,
    } as any);
    setUploading(false);
    if (error) return toast.error(error.message);
    setName(""); setDescription(""); setFile(null);
    toast.success("Template uploaded");
    load();
  };

  const open = async (path: string) => {
    const { data } = await supabase.storage.from("offer-templates").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (id: string, path: string) => {
    await supabase.storage.from("offer-templates").remove([path]);
    await supabase.from("workflow_offer_templates").delete().eq("id", id);
    setItems((p) => p.filter((x) => x.id !== id));
    toast.success("Removed");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offer templates — {workflowName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload new template</p>
            <Input className="w-full" placeholder="Template name (e.g. Tutor offer letter)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea className="w-full resize-none break-words" placeholder="Short description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer">
                <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted">
                  <Upload className="w-3 h-3" /> {file ? file.name : "Choose file"}
                </span>
              </label>
              <Button size="sm" disabled={!file || !name.trim() || uploading} onClick={upload} className="btn-gradient-primary text-primary-foreground">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Upload"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing templates</p>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No templates yet.</p>
            ) : items.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 border rounded-lg gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.file_name}{t.description ? ` — ${t.description}` : ""}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => open(t.file_path)}><Eye className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(t.id, t.file_path)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};