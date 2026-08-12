import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-utils";

import { MarketplaceApplicationCard } from "./MarketplaceApplicationCard";

vi.mock("./MarketplaceInstallButton", () => ({
  MarketplaceInstallButton: () => <button type="button">安装</button>,
}));

describe("MarketplaceApplicationCard", () => {
  it("renders the video production icon contract", () => {
    const { container } = render(
      <MarketplaceApplicationCard
        application={{
          slug: "video-production-expert",
          name: "视频制作伙伴",
          summary: "制作短视频",
          description: "从脚本到成片",
          category: "video",
          icon: "clapperboard",
          agent_slug: "video-studio",
          skill_slugs: ["remotion-best-practices"],
          tags: ["short-video"],
          outcomes: ["playable mp4"],
          version: 1,
          featured: true,
        }}
      />,
    );

    expect(screen.getByText("视频制作伙伴")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-clapperboard")).not.toBeNull();
  });

  it("renders design and course partner icon contracts", () => {
    for (const [icon, selector] of [
      ["palette", "svg.lucide-palette"],
      ["graduation-cap", "svg.lucide-graduation-cap"],
    ] as const) {
      const { container, unmount } = render(
        <MarketplaceApplicationCard
          application={{
            slug: `partner-${icon}`,
            name: `伙伴 ${icon}`,
            summary: "伙伴能力",
            description: "领域交付",
            category: "partner",
            icon,
            agent_slug: "codex-cli",
            skill_slugs: ["course-builder"],
            tags: ["partner"],
            outcomes: ["verified delivery"],
            version: 1,
            featured: false,
          }}
        />,
      );

      expect(container.querySelector(selector)).not.toBeNull();
      unmount();
    }
  });
});
