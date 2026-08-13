"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Bot,
  Clock3,
  Pencil,
  Play,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Expert } from "@/lib/api/expertApi";
import {
  expertAutomationKey,
  expertCategory,
  expertOriginKey,
} from "@/lib/expert-profile-display";
import { formatTimeAgo } from "@/lib/utils/time";
import { PartnerAvatar } from "./PartnerAvatar";

interface PartnerProfileHeaderProps {
  expert: Expert;
  orgSlug: string;
  running: boolean;
  canDelete: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}

export function PartnerProfileHeader({
  expert,
  orgSlug,
  running,
  canDelete,
  onRun,
  onEdit,
  onDelete,
  onShare,
}: PartnerProfileHeaderProps) {
  const t = useTranslations("experts");
  const tp = useTranslations("partnerProfile");
  const ts = useTranslations("partnerStatistics");
  const tRoot = useTranslations();
  const category = expertCategory(expert);

  return (
    <header className="border-b border-border bg-muted/20 px-4 py-5 sm:px-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <PartnerAvatar expert={expert} orgSlug={orgSlug} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{expert.name}</h1>
              {category && <Badge variant="info">{category}</Badge>}
              {expert.perpetual && <Badge variant="success">{t("perpetual")}</Badge>}
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{expert.slug}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {expert.description?.trim() || tp("noDescription")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                {expert.agent_slug}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" />
                {expert.run_count > 0
                  ? t("runCount", { count: expert.run_count })
                  : t("neverRun")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {expert.last_run_at
                  ? t("lastRun", {
                      time: formatTimeAgo(expert.last_run_at, tRoot),
                    })
                  : t("neverRun")}
              </span>
              <Badge variant="outline" className="font-normal">
                {tp(expertAutomationKey(expert))}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {tp(expertOriginKey(expert))}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:shrink-0">
          <Button
            size="sm"
            onClick={onRun}
            disabled={running}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? t("running") : t("runExpert")}
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Link href={`/${orgSlug}/partner-statistics`}>
              <BarChart3 className="h-3.5 w-3.5" />
              {ts("title")}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("edit.editExpert")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onShare}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <Users className="h-3.5 w-3.5" />
            {tRoot("share.title")}
          </Button>
          {canDelete && (
            <Button size="sm" variant="outline" onClick={onDelete} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {t("deleteExpert")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
