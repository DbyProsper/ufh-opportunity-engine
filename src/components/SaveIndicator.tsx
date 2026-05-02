import { Check, Loader2, AlertTriangle } from "lucide-react";
import type { SaveStatus } from "@/hooks/useSectionAutoSave";

export const SaveIndicator = ({ status }: { status: SaveStatus }) => {
  if (status === "saving") {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-xs text-success flex items-center gap-1">
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-xs text-destructive flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Save failed
      </span>
    );
  }
  return null;
};

export default SaveIndicator;