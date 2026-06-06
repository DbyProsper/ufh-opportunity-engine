import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Calendar, CheckCircle2, ExternalLink, Loader2, Lock, Sparkles, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { checkEligibility } from "@/lib/eligibility";
import { explainEligibility, scoreEligibility } from "@/lib/ai";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { OpportunityImage } from "@/components/OpportunityImage";

interface Props {
  open: boolean;
  onClose: () => void;
  workflow?: Tables<"workflows"> | null;
  externalOpp?: Tables<"external_opportunities"> | null;
  profile: Partial<Tables<"profiles">> | null;
  roles: string[];
  rules: Tables<"eligibility_rules">[];
  userId?: string;
  applicationStatus?: string | null;
}

export const OpportunityDetailsDialog = ({ open, onClose, workflow, externalOpp, profile, roles, rules, userId, applicationStatus }: Props) => {
  const [explain, setExplain] = useState<string>("");
  const [loadingExplain, setLoadingExplain] = useState(false);

  const isExternal = !!externalOpp;
  const title = workflow?.name ?? externalOpp?.title ?? "Opportunity";
  const description = workflow?.description ?? externalOpp?.description ?? "";
  const deadline = workflow?.deadline ?? externalOpp?.deadline;
  const requirements = externalOpp?.requirements ?? "";

  const elig = workflow ? checkEligibility(profile, roles, workflow, rules) : { eligible: true, reasons: [], positive: [] };
  const scored = workflow ? scoreEligibility(profile, roles, workflow, rules) : null;

  useEffect(() => {
    if (!open || !workflow) { setExplain(""); return; }
    setLoadingExplain(true);
    explainEligibility(workflow, profile, scored!)
      .then(setExplain)
      .finally(() => setLoadingExplain(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workflow?.id]);

  const handleExternalApply = async () => {
    if (!externalOpp) return;
    if (userId) {
      try {
        await supabase.from("external_application_clicks" as any).insert({
          user_id: userId,
          external_opportunity_id: externalOpp.id,
          external_link: externalOpp.external_link,
        } as any);
      } catch (e) { console.error(e); }
    }
    if (externalOpp.external_link) window.open(externalOpp.external_link, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-3">
            <span>{title}</span>
            {isExternal ? (
              <Badge variant="outline"><ExternalLink className="w-3 h-3 mr-1" />External</Badge>
            ) : elig.eligible ? (
              <Badge className="bg-success/10 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Eligible</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground"><Lock className="w-3 h-3 mr-1" />Restricted</Badge>
            )}
          </DialogTitle>
          {(workflow?.faculty || workflow?.department || externalOpp?.organization) && (
            <DialogDescription>
              {externalOpp?.organization || [workflow?.faculty, workflow?.department].filter(Boolean).join(" · ")}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <OpportunityImage
            image_url={(workflow as any)?.image_url ?? (externalOpp as any)?.image_url}
            category={(workflow as any)?.category ?? (externalOpp as any)?.category}
            name={title}
            description={description}
            aspect="video"
            className="rounded-lg"
            priority
          />
          {description && <p className="text-sm whitespace-pre-wrap leading-relaxed">{description}</p>}

          {requirements && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Requirements</p>
              <p className="text-sm whitespace-pre-wrap">{requirements}</p>
            </div>
          )}

          {deadline && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" /> Closes {format(new Date(deadline), "PPP")}
            </div>
          )}

          {workflow && scored && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Eligibility check</p>
                <span className="text-sm font-semibold">{scored.score}/100</span>
              </div>
              <Progress value={scored.score} className="h-2" />
              {loadingExplain ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Analysing your profile…</p>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{explain}</p>
              )}
              {scored.positive.length > 0 && (
                <ul className="space-y-1">
                  {scored.positive.map((p, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-success" /> {p}</li>
                  ))}
                </ul>
              )}
              {scored.reasons.length > 0 && (
                <ul className="space-y-1">
                  {scored.reasons.map((r, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5"><XCircle className="w-3 h-3 text-destructive" /> {r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {isExternal ? (
            <Button className="btn-gradient-primary text-primary-foreground" onClick={handleExternalApply} disabled={!externalOpp?.external_link}>
              Apply externally <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          ) : workflow ? (
            elig.eligible ? (
              <Link to={`/apply/${workflow.slug}`} onClick={onClose}>
                <Button className="btn-gradient-primary text-primary-foreground">
                  {applicationStatus ? "Continue application" : "Start application"} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button disabled title="You don't meet the eligibility requirements">
                <Lock className="w-4 h-4 mr-1" /> Not eligible
              </Button>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityDetailsDialog;