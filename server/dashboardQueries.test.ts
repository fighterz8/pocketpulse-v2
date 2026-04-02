import { describe, expect, it } from "vitest";

describe("dashboardQueries", () => {
  it("exports buildDashboardSummary function", async () => {
    const mod = await import("./dashboardQueries.js");
    expect(typeof mod.buildDashboardSummary).toBe("function");
  });

  it("DashboardSummary type is represented by buildDashboardSummary", async () => {
    const mod = await import("./dashboardQueries.js");
    expect(mod.buildDashboardSummary).toBeDefined();
  });
});
