import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eraser, Loader2, PenLine, Type, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: "personal_info" | "acceptance" | "affidavit" | "offer" | "general";
  applicationId?: string;
  offerId?: string;
  onSaved?: (sig: { id: string; file_path: string; file_name: string; method: string }) => void;
}

/**
 * Captures a signature via draw, type or upload.
 * Stores PNG in `signatures` bucket and a row in `signatures` table
 * with IP, user-agent and method (legal audit metadata).
 */
export const SignaturePad = ({ open, onOpenChange, context, applicationId, offerId, onSaved }: Props) => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [typed, setTyped] = useState("");
  const [uploaded, setUploaded] = useState<File | null>(null);
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [saving, setSaving] = useState(false);

  // Setup canvas dpi
  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  }, [open, tab]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => setDrawing(false);

  const clear = () => {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  };

  const renderTyped = (): Blob | null => {
    if (!typed.trim()) return null;
    const c = document.createElement("canvas");
    c.width = 600; c.height = 180;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "italic 56px 'Brush Script MT', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typed, 20, c.height / 2);
    let blob: Blob | null = null;
    // sync via dataURL
    const url = c.toDataURL("image/png");
    const bin = atob(url.split(",")[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    blob = new Blob([arr], { type: "image/png" });
    return blob;
  };

  const canvasBlob = (): Promise<Blob | null> =>
    new Promise((res) => canvasRef.current?.toBlob((b) => res(b), "image/png"));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let blob: Blob | null = null;
      let method: "draw" | "type" | "upload" = tab;
      let typedName: string | null = null;
      let fileExt = "png";
      let originalName = "signature.png";

      if (tab === "draw") {
        blob = await canvasBlob();
      } else if (tab === "type") {
        blob = renderTyped();
        typedName = typed.trim();
      } else if (tab === "upload" && uploaded) {
        blob = uploaded;
        fileExt = (uploaded.name.split(".").pop() || "png").toLowerCase();
        originalName = uploaded.name;
      }
      if (!blob) { toast.error("Provide a signature first"); setSaving(false); return; }

      const path = `${user.id}/${context}-${Date.now()}.${fileExt}`;
      const up = await supabase.storage.from("signatures").upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
      if (up.error) throw up.error;

      // Best-effort IP capture (client-side only).
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json())?.ip ?? null;
      } catch { /* ignore */ }

      const { data: row, error } = await supabase.from("signatures").insert({
        user_id: user.id,
        application_id: applicationId ?? null,
        offer_id: offerId ?? null,
        context,
        method,
        typed_name: typedName,
        file_path: path,
        file_name: originalName,
        ip_address: ip,
        user_agent: navigator.userAgent,
      } as never).select().single();
      if (error) throw error;

      toast.success("Signature saved");
      onSaved?.({ id: (row as any).id, file_path: path, file_name: originalName, method });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save signature");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add your signature</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="draw"><PenLine className="w-3.5 h-3.5 mr-1" /> Draw</TabsTrigger>
            <TabsTrigger value="type"><Type className="w-3.5 h-3.5 mr-1" /> Type</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="w-3.5 h-3.5 mr-1" /> Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="draw">
            <div className="border rounded-md bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-48 touch-none cursor-crosshair"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="ghost" onClick={clear}><Eraser className="w-3.5 h-3.5 mr-1" /> Clear</Button>
            </div>
          </TabsContent>
          <TabsContent value="type" className="space-y-2 pt-2">
            <Label>Your full name</Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Jane Doe" />
            {typed && (
              <div className="border rounded-md p-4 bg-white">
                <span className="text-3xl italic" style={{ fontFamily: "'Brush Script MT', cursive" }}>{typed}</span>
              </div>
            )}
          </TabsContent>
          <TabsContent value="upload" className="space-y-2 pt-2">
            <Label>Upload signature image (PNG/JPG)</Label>
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => setUploaded(e.target.files?.[0] ?? null)} />
            {uploaded && <p className="text-xs text-muted-foreground">{uploaded.name}</p>}
          </TabsContent>
        </Tabs>
        <p className="text-[11px] text-muted-foreground">
          By saving you consent to your IP address, browser and timestamp being recorded as legal audit metadata.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="btn-gradient-primary text-primary-foreground" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Save signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};