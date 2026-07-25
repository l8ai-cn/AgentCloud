"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertMessage } from "@/components/ui/alert-message";
import { Spinner } from "@/components/ui/spinner";
import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import type {
  WorkerCreateOptions,
  WorkerSpecDraft,
} from "@/lib/api/facade/podConnect";
import type { AsyncState } from "../hooks/workerCreateDraft";
import { WorkerPrimaryModelField } from "./WorkerPrimaryModelField";
import { WorkerToolModelField } from "./WorkerToolModelField";
import { WorkerRuntimeOptionFields } from "./WorkerRuntimeOptionFields";

interface WorkerRuntimeStepProps {
  draft: WorkerSpecDraft;
  options: AsyncState<WorkerCreateOptions>;
  modelResources: AsyncState<EffectiveResource[]>;
  toolModelResources: AsyncState<EffectiveResource[]>;
  onPatch: (patch: Partial<WorkerSpecDraft>) => void;
  onWorkerTypeChange: (slug: string, schemaVersion: number) => void;
  t: (key: string) => string;
}

export function WorkerRuntimeStep(props: WorkerRuntimeStepProps) {
  const {
    draft,
    options,
    modelResources,
    toolModelResources,
    onPatch,
    onWorkerTypeChange,
    t,
  } = props;
  const [pendingRuntimeImageId, setPendingRuntimeImageId] = useState<number | null>(null);

  if (options.status === "idle" || options.status === "loading") {
    return <Spinner className="my-8" />;
  }
  if (options.status === "error") {
    return <AlertMessage type="error" message={options.error} />;
  }
  const data = options.data;
  const selectedWorkerType = data.worker_types.find(
    (option) => option.slug === draft.worker_type_slug,
  );
  const changeRuntimeImage = (runtimeImageId: number) => {
    if (runtimeImageId === draft.runtime_image_id) return;
    const image = data.runtime_images.find((option) => option.id === runtimeImageId);
    if (!image) return;
    if (image.worker_type_slugs[0] === draft.worker_type_slug) {
      onPatch({ runtime_image_id: runtimeImageId });
      return;
    }
    if (hasTypeSpecificValues(draft)) {
      setPendingRuntimeImageId(runtimeImageId);
      return;
    }
    applyRuntimeImage(runtimeImageId);
  };
  const applyRuntimeImage = (runtimeImageId: number) => {
    const image = data.runtime_images.find((option) => option.id === runtimeImageId);
    if (!image) return;
    const workerType = data.worker_types.find(
      (option) => option.selectable && option.slug === image.worker_type_slugs[0],
    );
    if (!workerType) return;
    onWorkerTypeChange(workerType.slug, workerType.schema_version);
    onPatch({ runtime_image_id: runtimeImageId });
  };

  return (
    <div className="space-y-5">
      {selectedWorkerType?.requires_model_resource && (
        <WorkerPrimaryModelField
          state={modelResources}
          draft={draft}
          onPatch={onPatch}
          t={t}
        />
      )}
      {selectedWorkerType?.tool_model_requirements.map((requirement) => (
        <WorkerToolModelField
          key={requirement.role}
          requirement={requirement}
          state={toolModelResources}
          draft={draft}
          onPatch={onPatch}
          t={t}
        />
      ))}
      <WorkerRuntimeOptionFields
        draft={draft}
        data={data}
        onPatch={onPatch}
        onRuntimeImageChange={changeRuntimeImage}
        t={t}
      />

      <AlertDialog
        open={pendingRuntimeImageId !== null}
        onOpenChange={(open) => !open && setPendingRuntimeImageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workerCreate.imageChange.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workerCreate.imageChange.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("workerCreate.imageChange.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRuntimeImageId) applyRuntimeImage(pendingRuntimeImageId);
                setPendingRuntimeImageId(null);
              }}
            >
              {t("workerCreate.imageChange.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function hasTypeSpecificValues(draft: WorkerSpecDraft): boolean {
  return Boolean(
    draft.worker_type_slug ||
      draft.model_resource_id ||
      Object.keys(draft.tool_model_resource_ids).length ||
      draft.runtime_image_id ||
      Object.keys(draft.type_config_values).length ||
      draft.secret_refs.length ||
      draft.skill_ids.length ||
      draft.env_bundle_ids.length ||
      draft.config_document_bindings.length ||
      draft.custom_resources,
  );
}
