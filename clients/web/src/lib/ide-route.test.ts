import { describe, expect, it } from "vitest";
import {
  activityRoute,
  pathnameHidesIdeSidebar,
  resolveActivityFromPathname,
} from "./ide-route";

describe("resolveActivityFromPathname", () => {
  it("resolves api-access for org slugs containing workspace", () => {
    expect(resolveActivityFromPathname("/admin-workspace/api-access")).toBe("apiAccess");
    expect(resolveActivityFromPathname("/dev-org/workspace")).toBe("workspace");
  });

  it("treats the organization marketplace as a first-class activity", () => {
    expect(resolveActivityFromPathname("/dev-org/marketplace")).toBe("marketplace");
    expect(resolveActivityFromPathname("/dev-org/marketplace/acquire")).toBe("marketplace");
  });

  it("treats connections as a first-class activity", () => {
    expect(resolveActivityFromPathname("/dev-org/connections")).toBe("connections");
  });

  it("maps applications into the experts activity", () => {
    expect(resolveActivityFromPathname("/dev-org/applications")).toBe("experts");
    expect(resolveActivityFromPathname("/dev-org/applications/installation-1")).toBe("experts");
  });
});

describe("activityRoute", () => {
  it("routes connections and the three market activities", () => {
    expect(activityRoute("dev-org", "connections")).toBe("/dev-org/connections");
    expect(activityRoute("dev-org", "marketplace")).toBe("/dev-org/marketplace");
    expect(activityRoute("dev-org", "skills")).toBe("/dev-org/skills");
    expect(activityRoute("dev-org", "experts")).toBe("/dev-org/experts");
  });
});

describe("pathnameHidesIdeSidebar", () => {
  it("hides IDE sidebar on standalone dashboard pages", () => {
    expect(pathnameHidesIdeSidebar("/admin-workspace/api-access")).toBe(true);
    expect(pathnameHidesIdeSidebar("/dev-org/automation")).toBe(true);
    expect(pathnameHidesIdeSidebar("/dev-org/knowledge-base")).toBe(true);
    expect(pathnameHidesIdeSidebar("/dev-org/channels")).toBe(false);
  });
});
