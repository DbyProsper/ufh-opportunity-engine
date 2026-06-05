import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (workflow: any) => void;
}

/** Single chat-style prompt + a few optional structured overrides.
 *  The edge function generates a complete workflow with default common fields,
 *  steps, documents and eligibility rules in one call. */
export const AIWorkflowDialog = ({ open, onClose, onCreated }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState<"student" | "staff" | "any">("student");
  const [faculty, setFaculty] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) { toast.error("Describe the workflow first"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-workflow", {
        body: {
          prompt,
          overrides: {
            target_role: audience,
            faculty: faculty || undefined,
            deadline: deadline || undefined,
            is_active: false,
          },
        },
      });
      if (error) throw error;
      const wf = (data as any)?.workflow;
      if (!wf) throw new Error("AI did not return a workflow");
      toast.success(`Created "${wf.name}" — opening editor`);
      onCreated(wf);
      setPrompt(""); setFaculty(""); setDeadline("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Create workflow with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need. AI will generate a complete workflow with the standard personal,
            address and academic fields auto-filled from each applicant's profile, plus any extras you ask for.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>What's the workflow for?</Label>
            <Textarea
              rows={5}
              placeholder="Example: Tutor application for the Faculty of Science. Need a motivation letter, two academic references, transcript, and confirmation of registration. Restrict to students in years 3-4."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="any">Anyone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Faculty (optional)</Label>
              <Input value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Science" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deadline (optional)</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The new workflow starts as a draft (inactive). Review and refine in the editor before activating.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="btn-gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Generate workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIWorkflowDialog;