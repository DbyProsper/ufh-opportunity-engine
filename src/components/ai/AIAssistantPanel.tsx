import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, ChevronRight, ChevronLeft, RefreshCw, Plus, Wand2 } from "lucide-react";
import { generateSuggestion, rewriteSuggestion } from "@/lib/ai";
import { toast } from "sonner";

interface Props {
  activeField: { id: string; label: string; help_text?: string; type?: string } | null;
  profile: any;
  workflow: { name: string; description?: string | null } | null;
  onInsert: (fieldId: string, text: string) => void;
  applicationId?: string;
  currentValue?: string;
}

/**
 * Collapsible AI Assistant for the application form. Knows which field the
 * user is currently editing and produces a real suggestion via the ai-assist
 * edge function (with rule-based fallback).
 */
export const AIAssistantPanel = ({ activeField, profile, workflow, onInsert, applicationId, currentValue }: Props) => {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string>("");
  const [source, setSource] = useState<"ai" | "rules" | null>(null);

  // Auto-save suggestion per (application, field) so it survives navigation/refresh
  const cacheKey = (fid: string) => `ai-suggest:${applicationId ?? "app"}:${fid}`;

  useEffect(() => {
    if (!activeField) { setSuggestion(""); setSource(null); return; }
    try {
      const cached = window.localStorage.getItem(cacheKey(activeField.id));
      if (cached) { setSuggestion(cached); setSource("ai"); }
      else { setSuggestion(""); setSource(null); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField?.id, applicationId]);

  // Keyboard shortcuts: Ctrl/Cmd + G (generate), R (regenerate), I (insert)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "g") { e.preventDefault(); generate(false); }
      else if (k === "r" && suggestion) { e.preventDefault(); generate(true); }
      else if (k === "i" && suggestion && activeField) { e.preventDefault(); onInsert(activeField.id, suggestion); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField?.id, suggestion]);

  const generate = async (regenerate = false) => {
    if (!activeField) {
      toast.info("Click into a field first, then ask the AI Assistant.");
      return;
    }
    setLoading(true);
    setSuggestion("");
    try {
      const res = await generateSuggestion(activeField, profile, workflow, { regenerate });
      setSuggestion(res.text);
      setSource(res.source);
      try { if (activeField) window.localStorage.setItem(cacheKey(activeField.id), res.text); } catch {}
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate");
    } finally {
      setLoading(false);
    }
  };

  const rewrite = async () => {
    if (!activeField) { toast.info("Click into a field first."); return; }
    if (!currentValue || !currentValue.trim()) {
      toast.info("Type a draft into the field first, then click Rewrite.");
      return;
    }
    setLoading(true);
    setSuggestion("");
    try {
      const res = await rewriteSuggestion(activeField, currentValue, profile, workflow);
      setSuggestion(res.text);
      setSource(res.source);
      try { window.localStorage.setItem(cacheKey(activeField.id), res.text); } catch {}
    } catch (e: any) {
      toast.error(e?.message ?? "Could not rewrite");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        aria-label="Open AI Assistant"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-1/3 z-30 rounded-l-lg bg-primary text-primary-foreground px-2 py-3 shadow-lg hover:bg-primary/90 flex items-center gap-1"
      >
        <Sparkles className="w-4 h-4" />
        <ChevronLeft className="w-3 h-3" />
      </button>
    );
  }

  return (
    <Card className="fixed right-3 top-24 bottom-6 z-30 w-[320px] max-w-[90vw] shadow-xl flex flex-col border-accent/30">
      <div className="p-3 border-b flex items-center justify-between bg-accent/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/15 text-accent flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Assistant</p>
            <p className="text-[10px] text-muted-foreground">Context-aware writing help</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Active field</p>
        {activeField ? (
          <p className="text-sm font-medium leading-tight">{activeField.label}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Click a field to begin.</p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
            </div>
          )}
          {!loading && !suggestion && (
            <p className="text-xs text-muted-foreground">
              Press <span className="font-medium">Generate suggestion</span> to draft an answer based on your profile and the field you're filling.
            </p>
          )}
          {!loading && suggestion && (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                {suggestion}
              </div>
              {source && (
                <Badge variant="outline" className="text-[10px]">
                  {source === "ai" ? "AI generated" : "Smart template"}
                </Badge>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t space-y-2 bg-background">
        <Button
          size="sm"
          className="w-full btn-gradient-primary text-primary-foreground"
          disabled={!activeField || loading}
          onClick={() => generate(false)}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          Generate suggestion (Ctrl+G)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={!activeField || loading || !currentValue?.trim()}
          onClick={rewrite}
          title="Polish my draft using my profile and the opportunity context"
        >
          <Wand2 className="w-3.5 h-3.5 mr-1" /> Rewrite my draft
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={!suggestion || loading}
            onClick={() => generate(true)}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Regen (Ctrl+R)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={!suggestion || !activeField}
            onClick={() => activeField && onInsert(activeField.id, suggestion)}
          >
            <Plus className="w-3 h-3 mr-1" /> Insert (Ctrl+I)
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AIAssistantPanel;
