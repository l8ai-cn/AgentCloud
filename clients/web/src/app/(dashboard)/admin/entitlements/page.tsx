"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntitlementResourcePicker } from "@/components/entitlement/EntitlementResourcePicker";
import { entitlementKindLabel } from "@/components/entitlement/entitlementKindLabel";
import type { EntitlementKind } from "@/lib/api/entitlement/entitlementTypes";
import { EntitlementSummaryCard } from "./EntitlementSummaryCard";
import {
  EntitlementWriteDialog,
  type EntitlementWriteTarget,
} from "./EntitlementWriteDialog";
import { OrganizationScopePicker } from "./OrganizationScopePicker";
import { useAdminEntitlements, type EntitlementScope } from "./useAdminEntitlements";
import { useAdminOrganizationDirectory } from "./useAdminOrganizationDirectory";

export default function AdminEntitlementsPage() {
  const t = useTranslations("admin");
  const tKind = useTranslations("entitlement");
  const [tab, setTab] = useState("resource");
  const [kind, setKind] = useState<EntitlementKind>("worker_type");
  const [resourceKey, setResourceKey] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [writeTarget, setWriteTarget] = useState<EntitlementWriteTarget | null>(null);

  const directory = useAdminOrganizationDirectory(orgSearch);

  const scope = useMemo<EntitlementScope | null>(() => {
    if (tab === "resource") {
      return resourceKey
        ? { mode: "resource", resourceKind: kind, resourceKey }
        : null;
    }
    return organizationId ? { mode: "organization", organizationId } : null;
  }, [kind, organizationId, resourceKey, tab]);

  const { summaries, loading, error, busyId, reload, write, remove } =
    useAdminEntitlements(scope);

  const cards = summaries.map((summary) => (
    <EntitlementSummaryCard
      key={`${summary.organization_id}:${summary.resource_kind}:${summary.resource_key}`}
      summary={summary}
      title={
        tab === "resource"
          ? directory.label(summary.organization_id)
          : `${entitlementKindLabel(tKind, summary.resource_kind)} · ${summary.resource_key}`
      }
      subtitle={
        tab === "resource"
          ? `${summary.resource_kind} · ${summary.resource_key}`
          : directory.label(summary.organization_id)
      }
      busyId={busyId}
      resolveSubject={(record) =>
        record.subject_kind === "org"
          ? t("entitlements.subject.wholeOrg")
          : t("entitlements.subject.user", { id: record.subject_user_id ?? 0 })
      }
      onWrite={(effect) =>
        setWriteTarget({
          resourceKind: summary.resource_kind,
          resourceKey: summary.resource_key,
          organizationId: summary.organization_id,
          effect,
        })
      }
      onRemove={(record) => remove(record.id)}
    />
  ));

  const canCreate = tab === "resource" ? Boolean(resourceKey) : organizationId !== null;

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("nav.entitlements")}
        subtitle={t("entitlements.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resource">{t("entitlements.tabs.byResource")}</TabsTrigger>
          <TabsTrigger value="organization">
            {t("entitlements.tabs.byOrganization")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resource" className="flex flex-wrap items-end gap-3 pt-2">
          <EntitlementResourcePicker
            kind={kind}
            resourceKey={resourceKey}
            onKindChange={setKind}
            onResourceKeyChange={setResourceKey}
          />
          <Button
            size="sm"
            disabled={!resourceKey}
            onClick={() =>
              setWriteTarget({
                resourceKind: kind,
                resourceKey,
                organizationId: 0,
                effect: "allow",
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("entitlements.actions.admitOrganization")}
          </Button>
        </TabsContent>

        <TabsContent value="organization" className="space-y-4 pt-2">
          <OrganizationScopePicker
            search={orgSearch}
            organizations={directory.organizations}
            selectedId={organizationId}
            onSearchChange={setOrgSearch}
            onSelect={setOrganizationId}
          />
        </TabsContent>
      </Tabs>

      {error && <AlertMessage type="error" message={error} />}

      {!canCreate ? (
        <EmptyState
          title={t("entitlements.pickScope.title")}
          description={t("entitlements.pickScope.description")}
        />
      ) : summaries.length === 0 && !loading ? (
        <EmptyState
          title={t("entitlements.empty.title")}
          description={t("entitlements.empty.description")}
          actions={
            tab === "resource" ? (
              <Button
                size="sm"
                onClick={() =>
                  setWriteTarget({
                    resourceKind: kind,
                    resourceKey,
                    organizationId: 0,
                    effect: "allow",
                  })
                }
              >
                {t("entitlements.actions.grant")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">{cards}</div>
      )}

      <EntitlementWriteDialog
        target={writeTarget}
        organizations={directory.organizations}
        onClose={() => setWriteTarget(null)}
        onSubmit={write}
      />
    </div>
  );
}
