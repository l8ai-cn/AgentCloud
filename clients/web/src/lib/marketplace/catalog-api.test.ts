import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchMarketplaceListingDetail,
  fetchMarketplaceListings,
  fetchMarketplaceSummary,
} from "./catalog-api";

describe("marketplace catalog API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("reads the catalog through the integrated public market API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [marketApplication()] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchMarketplaceListings()).resolves.toMatchObject([
      {
        slug: "pattern-design-partner",
        display_name: "花型设计伙伴",
        icon: "palette",
        agent_slug: "pattern-designer",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/public/market/applications"),
      { cache: "no-store" },
    );
  });

  it("maps a published partner into a detail page payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [marketApplication()] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchMarketplaceListingDetail("pattern-design-partner"))
      .resolves.toMatchObject({
        slug: "pattern-design-partner",
        description: "把设计意图转成可复用的花型方案。",
        requirements: ["已配置兼容模型资源", "组织成员具备启用伙伴权限"],
        version: "2",
      });
  });

  it("uses an integrated organization market summary", async () => {
    await expect(fetchMarketplaceSummary()).resolves.toEqual({
      name: "AI 伙伴市场",
      summary: "为当前组织选择可以直接开始工作的 AI 伙伴。",
    });
  });
});

function marketApplication() {
  return {
    slug: "pattern-design-partner",
    name: "花型设计伙伴",
    summary: "生成可投产花型方案",
    description: "把设计意图转成可复用的花型方案。",
    category: "design",
    icon: "palette",
    agent_slug: "pattern-designer",
    skill_slugs: ["pattern-generate"],
    tags: ["花型", "图案"],
    outcomes: ["生成连续纹样", "检查接缝质量"],
    version: 2,
    featured: true,
  };
}
