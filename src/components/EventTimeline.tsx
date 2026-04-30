import { Calendar, Check, Clock, Eye, FileText, RefreshCcw, Send, UserCheck, UserX, X, Stamp, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface TimelineEvent {
  id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  message?: string | null;
  version?: number | null;
  metadata?: any;
  created_at: string;
  actor_label?: string;
}

const ICONS: Record<string, any> = {
  created: FileText,
  submitted: Send,
  status_change: RefreshCcw,
  reviewer_assigned: UserCheck,
  reviewer_unassigned: UserX,
  signed_uploaded: Stamp,
  template_uploaded: FileText,
  edit: Pencil,
};

const STATUS_ICON: Record<string, any> = {
  approved: Check,
  rejected: X,
  under_review: Eye,
  changes_requested: Pencil,
  template_sent: Send,
  signed_uploaded: Stamp,
  revision_requested: RefreshCcw,
};

const labelFor = (e: TimelineEvent): string => {
  if (e.event_type === "status_change") {
    const t = (e.to_status ?? "").replace(/_/g, " ");
    return `Status → ${t}`;
  }
  if (e.event_type === "created") return "Created";
  if (e.event_type === "submitted") return "Submitted by applicant";
  if (e.event_type === "reviewer_assigned") return "Reviewer assigned";
  if (e.event_type === "reviewer_unassigned") return "Reviewer cleared";
  if (e.event_type === "signed_uploaded") return `Signed copy uploaded${e.version ? ` (v${e.version})` : ""}`;
  if (e.event_type === "template_uploaded") return `Template uploaded${e.version ? ` (v${e.version})` : ""}`;
  return e.event_type.replace(/_/g, " ");
};

export const EventTimeline = ({ events, empty = "No history yet." }: { events: TimelineEvent[]; empty?: string }) => {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{empty}</p>;
  }
  return (
    <ol className="relative border-l border-border pl-6 space-y-5">
      {events.map((e) => {
        const Icon =
          (e.event_type === "status_change" && e.to_status && STATUS_ICON[e.to_status]) ||
          ICONS[e.event_type] ||
          Clock;
        return (
          <li key={e.id}>
            <span className="absolute -left-[9px] flex w-4 h-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon className="w-2.5 h-2.5" />
            </span>
            <p className="text-sm font-medium capitalize">{labelFor(e)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {new Date(e.created_at).toLocaleString()} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
            </p>
            {e.message && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/40 border rounded p-2">{e.message}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default EventTimeline;