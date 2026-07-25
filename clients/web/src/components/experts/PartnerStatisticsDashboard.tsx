"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Package,
  PlayCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { PartnerStatistics } from "@/lib/partner-statistics-model";
import {
  expertAutomationLabelKey,
  expertCategory,
} from "@/lib/expert-profile-display";
import { formatTimeAgo } from "@/lib/utils/time";
import {
  PartnerCapabilityMetric,
  PartnerMetricCard,
  PartnerRateRow,
  PartnerStatisticsSection,
} from "./PartnerStatisticsPrimitives";

interface PartnerStatisticsDashboardProps {
  orgSlug: string;
  statistics: PartnerStatistics;
}

export function PartnerStatisticsDashboard({
  orgSlug,
  statistics,
}: PartnerStatisticsDashboardProps) {
  const t = useTranslations("experts");
  const tp = useTranslations("partnerProfile");
  const ts = useTranslations("partnerStatistics");
  const tRoot = useTranslations();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PartnerMetricCard
          icon={UsersRound}
          label={ts("totalPartners")}
          value={String(statistics.totalPartners)}
        />
        <PartnerMetricCard
          icon={PlayCircle}
          label={ts("totalRuns")}
          value={String(statistics.totalRuns)}
        />
        <PartnerMetricCard
          icon={Activity}
          label={ts("activatedPartners")}
          value={String(statistics.activatedPartners)}
          note={`${statistics.usageRate}%`}
        />
        <PartnerMetricCard
          icon={BadgeCheck}
          label={ts("profileCompleteness")}
          value={`${statistics.averageCompleteness}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PartnerStatisticsSection title={ts("activityTitle")}>
          <div className="space-y-4">
            <PartnerRateRow
              label={ts("activatedPartners")}
              value={statistics.usageRate}
              count={`${statistics.activatedPartners}/${statistics.totalPartners}`}
            />
            <PartnerRateRow
              label={ts("recentPartners")}
              value={statistics.recentRate}
              count={`${statistics.recentPartners}/${statistics.totalPartners}`}
            />
            <PartnerRateRow
              label={ts("perpetualPartners")}
              value={statistics.perpetualRate}
              count={`${statistics.perpetualPartners}/${statistics.totalPartners}`}
            />
          </div>
        </PartnerStatisticsSection>

        <PartnerStatisticsSection title={ts("capabilityTitle")}>
          <div className="grid grid-cols-3 gap-3">
            <PartnerCapabilityMetric
              icon={Sparkles}
              label={t("skills")}
              value={statistics.uniqueSkills}
            />
            <PartnerCapabilityMetric
              icon={BookOpen}
              label={t("knowledge")}
              value={statistics.uniqueKnowledge}
            />
            <PartnerCapabilityMetric
              icon={Package}
              label={t("envBundles")}
              value={statistics.uniqueEnvBundles}
            />
          </div>
        </PartnerStatisticsSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PartnerStatisticsSection title={ts("automationTitle")}>
          <div className="space-y-4">
            {statistics.automation.map((item) => (
              <PartnerRateRow
                key={item.key}
                label={tp(expertAutomationLabelKey(item.key))}
                value={item.percentage}
                count={String(item.count)}
              />
            ))}
          </div>
        </PartnerStatisticsSection>

        <PartnerStatisticsSection title={ts("categoryTitle")}>
          <div className="space-y-4">
            {statistics.categories.slice(0, 6).map((item) => (
              <PartnerRateRow
                key={item.key}
                label={item.key === "uncategorized" ? tp("typeNotSet") : item.key}
                value={item.percentage}
                count={String(item.count)}
              />
            ))}
          </div>
        </PartnerStatisticsSection>
      </div>

      <PartnerStatisticsSection
        title={ts("leaderboardTitle")}
        description={ts("scope")}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="pb-2 font-medium">{ts("partner")}</th>
                <th className="pb-2 font-medium">{tp("partnerType")}</th>
                <th className="pb-2 text-right font-medium">{ts("capabilities")}</th>
                <th className="pb-2 text-right font-medium">{ts("runs")}</th>
                <th className="pb-2 text-right font-medium">{ts("lastActive")}</th>
              </tr>
            </thead>
            <tbody>
              {statistics.leaderboard.map(({ expert, capabilityCount, completeness }) => (
                <tr key={expert.slug} className="border-b border-border/50 last:border-0">
                  <td className="py-3">
                    <Link
                      href={`/${orgSlug}/experts/${expert.slug}`}
                      className="font-medium hover:text-primary"
                    >
                      {expert.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {expert.slug} · {completeness}%
                    </p>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {expertCategory(expert) || tp("typeNotSet")}
                  </td>
                  <td className="py-3 text-right tabular-nums">{capabilityCount}</td>
                  <td className="py-3 text-right tabular-nums">{expert.run_count}</td>
                  <td className="py-3 text-right text-xs text-muted-foreground">
                    {expert.last_run_at
                      ? formatTimeAgo(expert.last_run_at, tRoot)
                      : t("neverRun")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PartnerStatisticsSection>
    </div>
  );
}
