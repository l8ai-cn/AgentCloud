import { describe, expect, it } from "vitest";
import type { Expert } from "@/lib/api/expertApi";
import { buildPartnerStatistics } from "@/lib/partner-statistics-model";

function expert(overrides: Partial<Expert>): Expert {
  return {
    id: 1,
    slug: "research-partner",
    name: "Research partner",
    description: "Researches customer questions",
    agent_slug: "codex-cli",
    interaction_mode: "acp",
    automation_level: "autonomous",
    perpetual: false,
    used_env_bundles: [],
    skill_slugs: [],
    knowledge_mounts: [],
    run_count: 0,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildPartnerStatistics", () => {
  it("aggregates usage, capabilities, activity, and profile quality", () => {
    const statistics = buildPartnerStatistics(
      [
        expert({
          run_count: 5,
          last_run_at: "2026-07-23T00:00:00Z",
          perpetual: true,
          prompt: "Investigate and cite evidence.",
          worker_spec_snapshot_id: 31,
          skill_slugs: ["web-research", "report"],
          knowledge_mounts: [{ slug: "company", mode: "ro" }],
          metadata: { expertType: "research" },
        }),
        expert({
          id: 2,
          slug: "ops-partner",
          name: "Ops partner",
          description: null,
          run_count: 1,
          last_run_at: "2026-07-01T00:00:00Z",
          automation_level: "interactive",
          used_env_bundles: ["production-readonly"],
          skill_slugs: ["report"],
          metadata: {},
        }),
      ],
      new Date("2026-07-24T00:00:00Z"),
    );

    expect(statistics.totalPartners).toBe(2);
    expect(statistics.totalRuns).toBe(6);
    expect(statistics.activatedPartners).toBe(2);
    expect(statistics.recentPartners).toBe(1);
    expect(statistics.perpetualPartners).toBe(1);
    expect(statistics.uniqueSkills).toBe(2);
    expect(statistics.uniqueKnowledge).toBe(1);
    expect(statistics.uniqueEnvBundles).toBe(1);
    expect(statistics.leaderboard[0].expert.slug).toBe("research-partner");
    expect(statistics.leaderboard[0].completeness).toBe(100);
    expect(statistics.averageCompleteness).toBe(60);
  });

  it("uses resource metadata category for resource-managed partners", () => {
    const statistics = buildPartnerStatistics([
      expert({
        orchestration_resource_id: 9,
        orchestration_resource_revision: 2,
        metadata: { category: "engineering", expertType: "legacy-value" },
      }),
    ]);

    expect(statistics.categories).toEqual([
      { key: "engineering", count: 1, percentage: 100 },
    ]);
  });

  it("surfaces unknown automation levels instead of treating them as autonomous", () => {
    const statistics = buildPartnerStatistics([
      expert({ automation_level: "supervised" }),
      expert({ id: 2, slug: "missing-level", automation_level: "" }),
    ]);

    expect(statistics.automation).toEqual([
      { key: "unknown", count: 2, percentage: 100 },
    ]);
  });
});
