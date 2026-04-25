import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, Lock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  workflow: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    deadline: string | null;
    icon: string | null;
    target_role: string;
  };
  eligible: boolean;
  reasons: string[];
  applicationStatus?: string | null;
}

export const OpportunityCard = ({ workflow, eligible, reasons, applicationStatus }: Props) => {
  const Icon = ((Icons as any)[workflow.icon || "GraduationCap"] as LucideIcon) || Icons.GraduationCap;
  const deadlinePast = workflow.deadline && new Date(workflow.deadline) < new Date();

  return (
    <Card
      className={`group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 ${
        eligible ? "opportunity-card-eligible" : "opportunity-card-ineligible"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 btn-gradient-primary" />
      <CardContent className="p-6 pt-7">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            eligible ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
          }`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {applicationStatus && (
              <Badge className={`status-${applicationStatus.replace("_","-")} capitalize`}>
                {applicationStatus.replace("_", " ")}
              </Badge>
            )}
            {eligible ? (
              <Badge className="bg-success/10 text-success border-success/30 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Eligible
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Lock className="w-3 h-3" /> Restricted
              </Badge>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2 leading-tight">
          {workflow.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {workflow.description}
        </p>

        {workflow.deadline && (
          <div className={`flex items-center gap-2 text-xs ${deadlinePast ? "text-destructive" : "text-muted-foreground"}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{deadlinePast ? "Closed" : "Closes"} {format(new Date(workflow.deadline), "PPP")}</span>
          </div>
        )}

        {!eligible && reasons.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            {reasons[0]}
          </p>
        )}
      </CardContent>
      <CardFooter className="px-6 pb-6 pt-0">
        <Link to={`/apply/${workflow.slug}`} className="w-full">
          <Button
            className={`w-full ${eligible ? "btn-gradient-primary text-primary-foreground" : ""}`}
            variant={eligible ? "default" : "outline"}
          >
            {applicationStatus ? "Continue Application" : eligible ? "Apply Now" : "View Details"}
            <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default OpportunityCard;