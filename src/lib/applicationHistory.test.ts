import { describe, expect, it } from "vitest";
import { getApplicationVerdictSummary, getVisibleApplications } from "./applicationHistory";

describe("getVisibleApplications", () => {
  it("hides applications that were dismissed from the dashboard", () => {
    const apps = [
      { id: "a1", workflow_id: "wf-1" },
      { id: "a2", workflow_id: "wf-2" },
    ] as Array<{ id: string; workflow_id: string }>;

    const visible = getVisibleApplications(apps, ["a1"]);

    expect(visible).toEqual([{ id: "a2", workflow_id: "wf-2" }]);
  });
});

describe("getApplicationVerdictSummary", () => {
  it("returns a rejection summary when the status is rejected", () => {
    expect(getApplicationVerdictSummary({ status: "rejected", rejection_reason: "Missing documents" })).toEqual({
      title: "Rejected",
      body: "Missing documents",
    });
  });
});
