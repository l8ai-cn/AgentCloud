"use client";

import { useState } from "react";
import { Settings2, Sparkles, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PodData } from "@/lib/api/facade/pod";

import { WorkerSettingsDialog } from "./WorkerSettingsDialog";
import { useWorkerSkillRemount } from "./useWorkerSkillRemount";

interface WorkerSkillMountsProps {
  pod: PodData;
  orgSlug: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WorkerSkillMounts({ pod, orgSlug, t }: WorkerSkillMountsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { saving, error, result, remount, reset } = useWorkerSkillRemount(
    orgSlug,
    pod.pod_key,
  );
  const slugs = pod.worker_skill_slugs ?? [];
  // Skills are pinned onto the worker's spec snapshot, so a worker created
  // without one has nothing to remount.
  const editable = Boolean(pod.worker_spec_snapshot_id);

  const openSettings = () => {
    reset();
    setSettingsOpen(true);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          {t("ide.bottomPanel.infoTab.skills")}
        </span>
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs"
            onClick={openSettings}
          >
            <Settings2 className="h-3 w-3" />
            {t("ide.bottomPanel.workerSettings.edit")}
          </Button>
        )}
      </div>

      {slugs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("ide.bottomPanel.workerSettings.noSkills")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slugs.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 font-mono text-xs"
            >
              <Sparkles className="h-3 w-3 shrink-0 text-primary" />
              {slug}
            </span>
          ))}
        </div>
      )}

      {/* The dialog closes on success, so this notice has to live outside it or
          the user never learns the sandbox was not touched. */}
      {result && !result.applied_to_runner && (
        <p className="text-xs text-muted-foreground">
          {t("ide.bottomPanel.workerSettings.appliesOnNextStart")}
        </p>
      )}

      {editable && settingsOpen && (
        <WorkerSettingsDialog
          pod={pod}
          open
          onOpenChange={setSettingsOpen}
          saving={saving}
          error={error}
          onSave={remount}
          t={t}
        />
      )}
    </div>
  );
}

export default WorkerSkillMounts;
