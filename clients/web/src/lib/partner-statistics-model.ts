import {
  parseExpertKnowledgeMounts,
  type Expert,
} from "@/lib/api/expertApi";
import {
  expertAutomationValue,
  expertCategory,
} from "@/lib/expert-profile-display";

export interface PartnerRankItem {
  expert: Expert;
  capabilityCount: number;
  completeness: number;
}

export interface PartnerDistributionItem {
  key: string;
  count: number;
  percentage: number;
}

export interface PartnerStatistics {
  totalPartners: number;
  totalRuns: number;
  activatedPartners: number;
  recentPartners: number;
  perpetualPartners: number;
  averageCompleteness: number;
  uniqueSkills: number;
  uniqueKnowledge: number;
  uniqueEnvBundles: number;
  usageRate: number;
  recentRate: number;
  perpetualRate: number;
  leaderboard: PartnerRankItem[];
  automation: PartnerDistributionItem[];
  categories: PartnerDistributionItem[];
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function profileCompleteness(expert: Expert): number {
  const knowledge = parseExpertKnowledgeMounts(expert.knowledge_mounts);
  const checks = [
    Boolean(expert.description?.trim()),
    Boolean(expertCategory(expert)),
    Boolean(expert.prompt?.trim() || expert.agentfile_layer?.trim()),
    (expert.skill_slugs?.length ?? 0) +
      knowledge.length +
      (expert.used_env_bundles?.length ?? 0) > 0,
    (expert.worker_spec_snapshot_id ?? 0) > 0,
  ];
  return percentage(checks.filter(Boolean).length, checks.length);
}

function distribution(
  counts: Map<string, number>,
  total: number,
): PartnerDistributionItem[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, percentage: percentage(count, total) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function buildPartnerStatistics(
  experts: Expert[],
  now = new Date(),
): PartnerStatistics {
  const recentCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const skills = new Set<string>();
  const knowledge = new Set<string>();
  const envBundles = new Set<string>();
  const automationCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const ranked = experts.map((expert) => {
    const mounts = parseExpertKnowledgeMounts(expert.knowledge_mounts);
    expert.skill_slugs?.forEach((item) => skills.add(item));
    mounts.forEach((item) => knowledge.add(item.slug));
    expert.used_env_bundles?.forEach((item) => envBundles.add(item));
    const automation = expertAutomationValue(expert.automation_level);
    automationCounts.set(automation, (automationCounts.get(automation) ?? 0) + 1);
    const category = expertCategory(expert) || "uncategorized";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    return {
      expert,
      capabilityCount:
        (expert.skill_slugs?.length ?? 0) +
        mounts.length +
        (expert.used_env_bundles?.length ?? 0),
      completeness: profileCompleteness(expert),
    };
  });
  const totalPartners = experts.length;
  const activatedPartners = experts.filter((expert) => expert.run_count > 0).length;
  const recentPartners = experts.filter((expert) => {
    if (!expert.last_run_at) return false;
    return new Date(expert.last_run_at).getTime() >= recentCutoff;
  }).length;
  const perpetualPartners = experts.filter((expert) => expert.perpetual).length;
  const completenessTotal = ranked.reduce((sum, item) => sum + item.completeness, 0);

  ranked.sort((left, right) =>
    right.expert.run_count - left.expert.run_count ||
    Date.parse(right.expert.last_run_at ?? "0") -
      Date.parse(left.expert.last_run_at ?? "0"));

  return {
    totalPartners,
    totalRuns: experts.reduce((sum, expert) => sum + expert.run_count, 0),
    activatedPartners,
    recentPartners,
    perpetualPartners,
    averageCompleteness: totalPartners
      ? Math.round(completenessTotal / totalPartners)
      : 0,
    uniqueSkills: skills.size,
    uniqueKnowledge: knowledge.size,
    uniqueEnvBundles: envBundles.size,
    usageRate: percentage(activatedPartners, totalPartners),
    recentRate: percentage(recentPartners, totalPartners),
    perpetualRate: percentage(perpetualPartners, totalPartners),
    leaderboard: ranked.slice(0, 10),
    automation: distribution(automationCounts, totalPartners),
    categories: distribution(categoryCounts, totalPartners),
  };
}
