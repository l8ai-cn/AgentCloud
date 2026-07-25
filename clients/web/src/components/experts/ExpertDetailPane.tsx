"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CenteredSpinner } from "@/components/ui/spinner";
import { useExpertStore, useCurrentExpert } from "@/stores/expert";
import { ExpertEditDrawer } from "./ExpertEditDrawer";
import { ExpertConfigList } from "./ExpertConfigList";
import { ExpertMarketOperations } from "./ExpertMarketOperations";
import { ExpertRevisionDialog } from "./ExpertRevisionDialog";
import { PartnerProfileHeader } from "./PartnerProfileHeader";
import { usePodStore } from "@/stores/pod";
import { getShortPodKey } from "@/lib/pod-display-name";
import { isResourceManagedExpert } from "@/lib/expert-profile-display";

interface ExpertDetailPaneProps {
  slug: string;
  orgSlug: string;
}

export function ExpertDetailPane({ slug, orgSlug }: ExpertDetailPaneProps) {
  const t = useTranslations("experts");
  const router = useRouter();
  const expert = useCurrentExpert();
  const expertLoading = useExpertStore((s) => s.expertLoading);
  const error = useExpertStore((s) => s.error);
  const runExpert = useExpertStore((s) => s.runExpert);
  const deleteExpert = useExpertStore((s) => s.deleteExpert);
  const clearError = useExpertStore((s) => s.clearError);
  const fetchExpert = useExpertStore((s) => s.fetchExpert);

  const [running, setRunning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (expertLoading && !expert) return <CenteredSpinner className="h-full" />;

  if (error && !expert) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { clearError(); fetchExpert(slug); }}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!expert) return null;

  const resourceManaged = isResourceManagedExpert(expert);

  const handleRun = async () => {
    setRunning(true);
    try {
      const { pod, warning } = await runExpert(slug);
      usePodStore.getState().upsertPod(pod);
      toast.success(t("runSuccess"), {
        description: t("runSuccessDescription", { podKey: getShortPodKey(pod.pod_key) }),
      });
      if (warning) toast.warning(warning);
      router.push(`/${orgSlug}/workspace?pod=${encodeURIComponent(pod.pod_key)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteExpert(slug);
      router.push(`/${orgSlug}/experts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PartnerProfileHeader
        expert={expert}
        orgSlug={orgSlug}
        running={running}
        canDelete={!resourceManaged}
        onRun={() => void handleRun()}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <ExpertMarketOperations
        key={slug}
        expertID={expert.id}
        expertSlug={slug}
        installedFromMarket={expert.source_market_application_id != null}
        submissionReady={Boolean(expert.worker_spec_snapshot_id)}
        onUpgraded={() => fetchExpert(slug)}
      />

      <ExpertConfigList expert={expert} />

      {resourceManaged ? (
        <ExpertRevisionDialog
          open={editOpen}
          orgSlug={orgSlug}
          expertSlug={slug}
          onOpenChange={setEditOpen}
          onApplied={() => {
            setEditOpen(false);
            void fetchExpert(slug);
          }}
        />
      ) : (
        <ExpertEditDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          expert={expert}
          onSaved={() => fetchExpert(slug)}
        />
      )}

      {!resourceManaged && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("deleteConfirmTitle")}
          description={t("deleteConfirmDescription")}
          confirmText={t("deleteExpert")}
          variant="destructive"
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
