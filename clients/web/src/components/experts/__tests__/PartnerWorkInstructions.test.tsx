import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Expert } from "@/lib/api/expertApi";
import { PartnerWorkInstructions } from "../PartnerWorkInstructions";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function expert(overrides: Partial<Expert>): Expert {
  return {
    id: 1,
    slug: "delivery-partner",
    name: "Delivery partner",
    agent_slug: "codex",
    interaction_mode: "acp",
    automation_level: "autonomous",
    perpetual: false,
    used_env_bundles: [],
    skill_slugs: [],
    knowledge_mounts: [],
    run_count: 0,
    created_at: "2026-07-24T00:00:00Z",
    updated_at: "2026-07-24T00:00:00Z",
    ...overrides,
  };
}

describe("PartnerWorkInstructions", () => {
  it("shows AgentFile instructions when no prompt exists", () => {
    render(
      <PartnerWorkInstructions
        expert={expert({ agentfile_layer: "ENV PARTNER_ROLE=delivery" })}
      />,
    );

    expect(screen.getByText("edit.agentfileLayerLabel")).toBeInTheDocument();
    expect(screen.getByText("ENV PARTNER_ROLE=delivery")).toBeInTheDocument();
    expect(screen.queryByText("noWorkInstructions")).not.toBeInTheDocument();
  });
});
