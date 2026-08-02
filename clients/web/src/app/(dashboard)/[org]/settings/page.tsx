"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrentOrg } from "@/stores/auth";
import {
  NotificationSettings,
  AgentConfigPage,
  GitSettingsContent,
  AIResourcesSettings,
  PersonalGeneralSettings,
} from "@/components/settings";
import {
  GeneralSettings,
  MembersSettings,
  BillingSettings,
  APIKeysSettings,
  IMChannelsSettings,
  ExtensionsSettings,
  UsageSettings,
  InfrastructureOverview,
} from "@/components/settings/organization";
import { SupportTicketsContent } from "@/components/support/SupportTicketsContent";

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || "personal";
  const activeTab = searchParams.get("tab") || "general";
  const currentOrg = useCurrentOrg();
  const t = useTranslations() as unknown as TranslationFn;

  const renderContent = () => {
    if (scope === "personal") {
      if (activeTab.startsWith("agents/")) {
        return <AgentConfigPage agentSlug={activeTab.replace("agents/", "")} />;
      }
      switch (activeTab) {
        case "general":
          return <PersonalGeneralSettings />;
        case "git":
          return <GitSettingsContent />;
        case "ai-resources":
          return <AIResourcesSettings scope="personal" canManage />;
        case "notifications":
          return <PersonalNotificationsSettings t={t} />;
        case "support":
          return <SupportTicketsContent variant="narrow" />;
        default:
          return <PersonalGeneralSettings />;
      }
    }

    switch (activeTab) {
      case "general":
        return <GeneralSettings org={currentOrg} t={t} />;
      case "members":
        return <MembersSettings t={t} />;
      case "extensions":
        return <ExtensionsSettings t={t} />;
      case "api-keys":
        return <APIKeysSettings t={t} />;
      case "im-channels":
        return <IMChannelsSettings t={t} />;
      case "billing":
        return <BillingSettings t={t} />;
      case "usage":
      case "model-quotas":
        return <UsageSettings t={t} />;
      case "ai-resources":
        return (
          <AIResourcesSettings
            scope="organization"
            organizationSlug={currentOrg?.slug}
            canManage={currentOrg?.role === "owner" || currentOrg?.role === "admin"}
          />
        );
      case "infrastructure":
        return <InfrastructureOverview />;
      default:
        return <GeneralSettings org={currentOrg} t={t} />;
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">{renderContent()}</div>
    </div>
  );
}

function PersonalNotificationsSettings({ t }: { t: TranslationFn }) {
  return (
    <div className="space-y-6">
      <div className="surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("settings.notifications.title")}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {t("settings.notifications.description")}
        </p>
        <NotificationSettings />
      </div>
    </div>
  );
}
