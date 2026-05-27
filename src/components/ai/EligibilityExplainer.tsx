import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { explainEligibility, scoreEligibility } from "@/lib/ai";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  workflow: Tables<"workflows">;
  profile: Partial<Tables<"profiles">> | null;
  roles: string[];
  rules: Tables<"eligibility_rules">[];
}

export const EligibilityExplainer = ({ workflow, profile, roles, rules }: Props) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const scored = scoreEligibility(profile, roles, workflow, rules);

  useEffect(() => {
    if (!open || text) return;
    setLoading(true);
    explainEligibility(workflow, profile, scored)
      .then((t) => setText(t))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-auto py-0.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      >
        <HelpCircle className="w-3 h-3 mr-1" /> Why?
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scored.eligible ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground" />
              )}
              {scored.eligible ? "You're eligible" : "Not eligible (yet)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <p className="text-xs text-muted-foreground">Match score</p>
                <p className="text-sm font-semibold">{scored.score}/100</p>
              </div>
              <Progress value={scored.score} className="h-2" />
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating explanation…
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
            )}

            {scored.positive.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5 text-success">What you match</p>
                <ul className="space-y-1">
                  {scored.positive.map((p, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-success shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scored.reasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1.5 text-muted-foreground">What's blocking</p>
                <ul className="space-y-1">
                  {scored.reasons.map((r, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5">
                      <XCircle className="w-3 h-3 text-destructive shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Badge variant="outline" className="text-[10px]">
              <Sparkles className="w-3 h-3 mr-1 text-accent" /> AI Eligibility Explainer
            </Badge>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EligibilityExplainer;
