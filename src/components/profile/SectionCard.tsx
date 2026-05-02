import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import { SaveIndicator } from "@/components/SaveIndicator";
import type { SaveStatus } from "@/hooks/useSectionAutoSave";

export type SectionStatus = "complete" | "incomplete" | "editing";

interface Props {
  title: string;
  description?: string;
  status: SectionStatus;
  saveStatus?: SaveStatus;
  children: ReactNode;
  actions?: ReactNode;
}

const STATUS_BADGE: Record<SectionStatus, { label: string; cls: string; Icon: any }> = {
  complete: { label: "Completed", cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
  incomplete: { label: "Incomplete", cls: "bg-warning/15 text-warning border-warning/30", Icon: AlertCircle },
  editing: { label: "Editable", cls: "bg-muted text-muted-foreground border-border", Icon: Pencil },
};

export const SectionCard = ({ title, description, status, saveStatus = "idle", children, actions }: Props) => {
  const s = STATUS_BADGE[status];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {title}
            <Badge variant="outline" className={`text-[10px] gap-1 ${s.cls}`}>
              <s.Icon className="w-3 h-3" />
              {s.label}
            </Badge>
          </CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SaveIndicator status={saveStatus} />
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export default SectionCard;