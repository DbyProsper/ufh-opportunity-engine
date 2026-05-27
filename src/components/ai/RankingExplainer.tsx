import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
import type { RankedApplication } from "@/lib/ai";

interface Props {
  open: boolean;
  onClose: () => void;
  ranked: RankedApplication | null;
  applicantName: string;
  workflowName: string;
}

export const RankingExplainer = ({ open, onClose, ranked, applicantName, workflowName }: Props) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Ranking explanation
        </DialogTitle>
      </DialogHeader>
      {ranked && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">{applicantName}</p>
            <p className="text-xs text-muted-foreground">{workflowName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="text-sm">#{ranked.rank}</Badge>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Match score</span>
                <span className="font-semibold">{ranked.score}/100</span>
              </div>
              <Progress value={ranked.score} className="h-2" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5">This applicant scored highly because:</p>
            <ul className="space-y-1">
              {ranked.reasons.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);

export default RankingExplainer;
