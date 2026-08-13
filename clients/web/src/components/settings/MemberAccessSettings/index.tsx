"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { entitlementKindLabel } from "@/components/entitlement/entitlementKindLabel";
import type { EntitlementKind } from "@/lib/api/entitlement/entitlementTypes";
import { useCurrentOrg } from "@/stores/auth";
import { MemberAccessResourceCard } from "./MemberAccessResourceCard";
import {
  MemberEntitlementDialog,
  type MemberEntitlementTarget,
} from "./MemberEntitlementDialog";
import { useMemberAccessEntitlements } from "./useMemberAccessEntitlements";
import { useOrgMemberDirectory } from "./useOrgMemberDirectory";

export function MemberAccessSettings() {
  const t = useTranslations("settings.memberAccess");
  const tKind = useTranslations("entitlement");
  const org = useCurrentOrg();
  const [target, setTarget] = useState<MemberEntitlementTarget | null>(null);
  const directory = useOrgMemberDirectory(org?.slug);
  const { summaries, loading, error, busyId, reload, write, remove } =
    useMemberAccessEntitlements(org?.slug, org?.id);

  // With zero rows a resource is open to everyone, so there is nothing to list
  // yet — the admin still needs a way to arm the first allow-list.
  const startRestriction = () =>
    setTarget({ resourceKind: "worker_type", resourceKey: "", effect: "allow" });

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
          <Button size="sm" onClick={startRestriction}>
            <Plus className="mr-2 h-4 w-4" />
            {t("actions.restrictResource")}
          </Button>
        </div>
      </header>

      {error && <AlertMessage type="error" message={error} />}

      {summaries.length === 0 && !loading ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          actions={
            <Button size="sm" onClick={startRestriction}>
              {t("actions.restrictResource")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <MemberAccessResourceCard
              key={`${summary.resource_kind}:${summary.resource_key}`}
              summary={summary}
              title={`${entitlementKindLabel(tKind, summary.resource_kind)} · ${summary.resource_key}`}
              busyId={busyId}
              memberLabel={directory.label}
              onWrite={(effect) =>
                setTarget({
                  resourceKind: summary.resource_kind as EntitlementKind,
                  resourceKey: summary.resource_key,
                  effect,
                })
              }
              onRemove={(record) => remove(record.id)}
            />
          ))}
        </div>
      )}

      {org && (
        <MemberEntitlementDialog
          orgSlug={org.slug}
          target={target}
          members={directory.members}
          memberLabel={directory.label}
          onClose={() => setTarget(null)}
          onSubmit={write}
        />
      )}
    </div>
  );
}
