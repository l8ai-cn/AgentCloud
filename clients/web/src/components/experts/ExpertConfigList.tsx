"use client";

import { useTranslations } from "next-intl";
import {
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  GitBranch,
  History,
  Layers3,
  Package,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { parseExpertKnowledgeMounts, type Expert } from "@/lib/api/expertApi";
import {
  expertAutomationKey,
  expertCategory,
  expertOriginKey,
  isResourceManagedExpert,
} from "@/lib/expert-profile-display";
import { formatTimeAgo } from "@/lib/utils/time";
import {
  PartnerProfileChips,
  PartnerProfileField,
  PartnerProfileSection,
} from "./PartnerProfileFields";
import { PartnerWorkInstructions } from "./PartnerWorkInstructions";

export function ExpertConfigList({ expert }: { expert: Expert }) {
  const t = useTranslations("experts");
  const tp = useTranslations("partnerProfile");
  const tRoot = useTranslations();
  const mounts = parseExpertKnowledgeMounts(expert.knowledge_mounts);
  const knowledgeItems = mounts.map((m) => (m.mode === "rw" ? `${m.slug} · rw` : m.slug));
  const category = expertCategory(expert);

  const modeLabel =
    expert.interaction_mode?.toLowerCase() === "acp"
      ? t("edit.modeAcp")
      : t("edit.modePty");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PartnerProfileSection icon={Bot} title={tp("profileSectionIdentity")}>
          <dl>
            <PartnerProfileField
              icon={Layers3}
              label={tp("partnerType")}
              value={category || tp("typeNotSet")}
            />
            <PartnerProfileField
              icon={Bot}
              label={t("agent")}
              value={<span className="font-mono text-xs">{expert.agent_slug}</span>}
            />
            <PartnerProfileField
              icon={Terminal}
              label={t("interactionMode")}
              value={<Badge variant="outline" className="font-normal">{modeLabel}</Badge>}
            />
            <PartnerProfileField
              icon={ShieldCheck}
              label={tp("automationLevel")}
              value={<Badge variant="outline">{tp(expertAutomationKey(expert))}</Badge>}
            />
          </dl>
        </PartnerProfileSection>

        <PartnerProfileSection icon={Server} title={t("configSectionRuntime")}>
          <dl>
            <PartnerProfileField
              icon={Zap}
              label={t("perpetual")}
              value={
                <Badge variant={expert.perpetual ? "success" : "secondary"} className="font-normal">
                  {expert.perpetual ? t("perpetualOn") : t("perpetualOff")}
                </Badge>
              }
            />
            {expert.runner_id != null && (
              <PartnerProfileField
                icon={Server}
                label={t("runner")}
                value={<span className="font-mono text-xs">#{expert.runner_id}</span>}
              />
            )}
            {expert.repository_id != null && (
              <PartnerProfileField
                icon={GitBranch}
                label={t("repository")}
                value={<span className="font-mono text-xs">#{expert.repository_id}</span>}
              />
            )}
            {expert.branch_name && (
              <PartnerProfileField
                icon={GitBranch}
                label={t("branch")}
                value={<span className="font-mono text-xs">{expert.branch_name}</span>}
              />
            )}
          </dl>
        </PartnerProfileSection>

        <PartnerProfileSection icon={Sparkles} title={t("configSectionCapabilities")}>
          <dl>
            <PartnerProfileField
              icon={Sparkles}
              label={t("skills")}
              value={<PartnerProfileChips items={expert.skill_slugs ?? []} empty={t("noSkills")} variant="info" />}
            />
            <PartnerProfileField
              icon={BookOpen}
              label={t("knowledge")}
              value={<PartnerProfileChips items={knowledgeItems} empty={t("noKnowledge")} variant="success" />}
            />
            <PartnerProfileField
              icon={Package}
              label={t("envBundles")}
              value={<PartnerProfileChips items={expert.used_env_bundles ?? []} empty={t("noEnvBundles")} />}
            />
          </dl>
        </PartnerProfileSection>

        <PartnerProfileSection icon={FileText} title={tp("workInstructions")}>
          <PartnerWorkInstructions expert={expert} />
        </PartnerProfileSection>

        <PartnerProfileSection icon={History} title={tp("profileSectionGovernance")}>
          <dl>
            <PartnerProfileField
              icon={ShieldCheck}
              label={tp("managementMode")}
              value={tp(isResourceManagedExpert(expert) ? "resourceManaged" : "directManaged")}
            />
            <PartnerProfileField
              icon={History}
              label={tp("origin")}
              value={tp(expertOriginKey(expert))}
            />
            {expert.worker_spec_snapshot_id != null && (
              <PartnerProfileField
                label={tp("workerSnapshot")}
                value={<span className="font-mono text-xs">#{expert.worker_spec_snapshot_id}</span>}
              />
            )}
            {expert.orchestration_resource_revision != null && (
              <PartnerProfileField
                label={tp("resourceRevision")}
                value={<span className="font-mono text-xs">r{expert.orchestration_resource_revision}</span>}
              />
            )}
            {expert.source_market_release_id != null && (
              <PartnerProfileField
                label={tp("marketRelease")}
                value={<span className="font-mono text-xs">#{expert.source_market_release_id}</span>}
              />
            )}
            <PartnerProfileField
              icon={CalendarDays}
              label={tp("createdAt")}
              value={formatTimeAgo(expert.created_at, tRoot)}
            />
            <PartnerProfileField
              icon={CalendarDays}
              label={tp("updatedAt")}
              value={formatTimeAgo(expert.updated_at, tRoot)}
            />
          </dl>
          {expert.source_pod_key && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("publishedFrom", { podKey: expert.source_pod_key })}
            </p>
          )}
        </PartnerProfileSection>
      </div>
    </div>
  );
}
