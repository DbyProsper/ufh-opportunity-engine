export interface ApplicationVerdictSummary {
  title: string;
  body: string;
}

export const getVisibleApplications = <T extends { id: string }>(apps: T[], dismissedIds: string[]) => {
  const dismissed = new Set(dismissedIds);
  return apps.filter((app) => !dismissed.has(app.id));
};

export const getApplicationVerdictSummary = (app: { status: string; review_notes?: string | null; rejection_reason?: string | null }) => {
  switch (app.status) {
    case "approved":
      return {
        title: "Approved",
        body: app.review_notes || "Your application has been approved.",
      };
    case "rejected":
      return {
        title: "Rejected",
        body: app.rejection_reason || app.review_notes || "Your application was not approved.",
      };
    case "changes_requested":
      return {
        title: "Changes requested",
        body: app.review_notes || "Please update the requested sections and resubmit your application.",
      };
    case "submitted":
    case "under_review":
      return {
        title: "Under review",
        body: "Your application is currently being reviewed.",
      };
    default:
      return {
        title: app.status.replace(/_/g, " "),
        body: app.review_notes || "Your application is still in progress.",
      };
  }
};
