"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Server, Plus } from "lucide-react";
import { useRunners, useRunnerStore } from "@/stores/runner";
import { useCurrentOrg } from "@/stores/auth";
import { useAutoSelectFirst } from "@/hooks/useAutoSelectFirst";
import { useCtaModal } from "@/hooks/useCtaModal";
import { InfraRunnerDetail } from "@/components/infra/InfraRunnerDetail";
import { InfraClusterDetail } from "@/components/infra/InfraClusterDetail";
import { AddRunnerModal } from "@/components/ide/modals/AddRunnerModal";
import { listExecutionClusters } from "@/lib/api/facade/executionClusterApi";
import type { ExecutionCluster } from "@/lib/api/facade/executionCluster";
import { summarizeInfraClusters } from "@/lib/infra-cluster-summary";

export function RunnerSection({
  orgSlug,
  selectedId,
  selectedClusterId,
  idMissing,
  clusterMissing,
  onBack,
}: {
  orgSlug: string;
  selectedId: number;
  selectedClusterId: number;
  idMissing: boolean;
  clusterMissing: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const currentOrg = useCurrentOrg();
  const runners = useRunners();
  const loading = useRunnerStore((s) => s.loading);
  const fetched = useRunnerStore((s) => s.fetched);
  const fetchRunners = useRunnerStore((s) => s.fetchRunners);
  const addModal = useCtaModal(fetchRunners);
  const [clusters, setClusters] = useState<ExecutionCluster[]>([]);

  const reload = useCallback(async () => {
    if (!currentOrg) return;
    const items = await listExecutionClusters(currentOrg.slug);
    setClusters(items);
    await fetchRunners();
  }, [currentOrg, fetchRunners]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void reload();
    });
  }, [reload]);

  const summaries = useMemo(
    () => summarizeInfraClusters(clusters, runners),
    [clusters, runners],
  );
  const firstClusterId = summaries[0]?.cluster.id ?? null;
  const selectedSummary = summaries.find((s) => s.cluster.id === selectedClusterId);

  useAutoSelectFirst({
    firstId: firstClusterId,
    idMissing: clusterMissing && idMissing,
    loading: loading && clusters.length === 0,
    fetched: fetched || clusters.length > 0,
    onNavigate: useCallback(
      (id) => router.replace(`/${orgSlug}/infra?tab=runners&cluster=${id}`),
      [router, orgSlug],
    ),
  });

  let body: React.ReactNode;
  if (loading && runners.length === 0 && clusters.length === 0) {
    body = <CenteredSpinner className="h-64" />;
  } else if (!Number.isNaN(selectedId)) {
    body = (
      <InfraRunnerDetail
        runnerId={selectedId}
        onBack={() => {
          const clusterId =
            runners.find((r) => r.id === selectedId)?.cluster_id ?? firstClusterId;
          if (clusterId != null) {
            router.push(`/${orgSlug}/infra?tab=runners&cluster=${clusterId}`);
          } else {
            onBack();
          }
        }}
      />
    );
  } else if (selectedSummary) {
    body = (
      <InfraClusterDetail
        summary={selectedSummary}
        onBack={onBack}
        onRefresh={() => void reload()}
        onSelectRunner={(runnerId) =>
          router.push(`/${orgSlug}/infra?tab=runners&id=${runnerId}`)
        }
      />
    );
  } else if (clusterMissing && idMissing && firstClusterId == null) {
    body = (
      <EmptyState
        size="full"
        icon={<Server className="h-12 w-12" />}
        title={t("runners.emptyState.title")}
        description={t("runners.emptyState.description")}
        actions={
          <Button onClick={addModal.open}>
            <Plus className="mr-1 h-4 w-4" />
            {t("runners.addRunner")}
          </Button>
        }
      />
    );
  } else {
    body = null;
  }

  return (
    <>
      {body}
      <AddRunnerModal
        open={addModal.isOpen}
        onClose={addModal.close}
        onCreated={addModal.commit}
      />
    </>
  );
}
