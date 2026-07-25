import {
  fetchPublicMarketApplications,
  type PublicMarketApplication,
} from "@/lib/public-market-api";

export const DEFAULT_MARKET_SLUG = "agent-cloud-market";

export type MarketplaceResourceType =
  | "application"
  | "skill"
  | "mcp_connector"
  | "resource";

export interface MarketplaceSpace {
  slug: string;
  name: string;
}

export interface MarketplaceListingSummary {
  listing_id: string;
  listing_version_id: string;
  slug: string;
  icon: PublicMarketApplication["icon"];
  agent_slug: string;
  skill_slugs: string[];
  outcomes: string[];
  resource_type: MarketplaceResourceType;
  display_name: string;
  tagline: string;
  publisher: {
    display_name: string;
    verified: boolean;
  };
  spaces: MarketplaceSpace[];
  quota?: {
    mode: string;
    estimated_credits_micro: string;
  };
}

export interface MarketplaceListingDetail extends MarketplaceListingSummary {
  description: string;
  use_cases: string[];
  target_audience: string[];
  requirements: string[];
  permissions: string[];
  version: string;
  release_notes: string;
  documentation_url?: string;
  support_url?: string;
}

export interface MarketplaceSummary {
  name: string;
  summary: string;
}

export function fetchMarketplaceSummary(): Promise<MarketplaceSummary> {
  return Promise.resolve({
    name: "AI 伙伴市场",
    summary: "为当前组织选择可以直接开始工作的 AI 伙伴。",
  });
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListingSummary[]> {
  const response = await fetchPublicMarketApplications();
  return response.items.map(marketListingSummary);
}

export async function fetchMarketplaceListingDetail(
  listingSlug: string,
): Promise<MarketplaceListingDetail> {
  const response = await fetchPublicMarketApplications();
  const application = response.items.find((item) => item.slug === listingSlug);
  if (!application) throw new Error("市场内容不存在或已下架。");
  return marketListingDetail(application);
}

function marketListingSummary(
  application: PublicMarketApplication,
): MarketplaceListingSummary {
  return {
    listing_id: application.slug,
    listing_version_id: String(application.version),
    slug: application.slug,
    icon: application.icon,
    agent_slug: application.agent_slug,
    skill_slugs: application.skill_slugs,
    outcomes: application.outcomes,
    resource_type: "application",
    display_name: application.name,
    tagline: application.summary,
    publisher: { display_name: "Agent Cloud", verified: true },
    spaces: [{ slug: application.category, name: categoryName(application.category) }],
  };
}

function marketListingDetail(
  application: PublicMarketApplication,
): MarketplaceListingDetail {
  return {
    ...marketListingSummary(application),
    description: application.description,
    use_cases: application.tags,
    target_audience: ["运营团队", "内容团队", "交付团队"],
    requirements: ["已配置兼容模型资源", "组织成员具备启用伙伴权限"],
    permissions: ["读取组织内必要的模型与 Skill 配置", "创建并维护对应 AI 伙伴档案"],
    version: String(application.version),
    release_notes: "内置伙伴目录同步发布。",
  };
}

function categoryName(category: string): string {
  const names: Record<string, string> = {
    design: "设计创作",
    education: "课程研发",
    video: "视频创作",
  };
  return names[category] ?? category;
}
