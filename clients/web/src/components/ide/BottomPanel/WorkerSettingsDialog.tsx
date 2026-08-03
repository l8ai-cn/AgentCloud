"use client";

import { useState } from "react";

import { SkillMultiSelect } from "@/components/pod/CreatePodForm/SkillMultiSelect";
import { useWorkerSkills } from "@/components/pod/hooks/useWorkerSkills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PodData } from "@/lib/api/facade/pod";

interface WorkerSettingsDialogProps {
  pod: PodData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  error: string | null;
  onSave: (skillIds: number[]) => Promise<boolean>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WorkerSettingsDialog({
  pod,
  open,
  onOpenChange,
  saving,
  error,
  onSave,
  t,
}: WorkerSettingsDialogProps) {
  const mounted = pod.worker_skill_slugs ?? [];
  const { skills, loading } = useWorkerSkills(pod.repository?.id ?? null);
  // Mounted only while open, so the selection starts from the live mounts on
  // every visit instead of being re-synced by an effect.
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(mounted);

  const dirty =
    selectedSlugs.length !== mounted.length ||
    selectedSlugs.some((slug) => !mounted.includes(slug));

  // The RPC pins by catalog id; slugs are only the UI-facing handle.
  const selectedIds = skills
    .filter((skill) => selectedSlugs.includes(skill.slug))
    .map((skill) => skill.id);
  const unresolved = selectedSlugs.filter(
    (slug) => !skills.some((skill) => skill.slug === slug),
  );

  const handleSave = async () => {
    if (await onSave(selectedIds)) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ide.bottomPanel.workerSettings.title")}</DialogTitle>
          <DialogDescription>
            {t("ide.bottomPanel.workerSettings.skillsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <SkillMultiSelect
            skills={skills}
            selectedSlugs={selectedSlugs}
            onChange={setSelectedSlugs}
            loading={loading}
            embedded
            t={t}
          />
          {unresolved.length > 0 && (
            <p className="text-xs text-warning">
              {t("ide.bottomPanel.workerSettings.unresolvedSkills", {
                slugs: unresolved.join(", "),
              })}
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty || unresolved.length > 0}>
            {saving
              ? t("ide.bottomPanel.workerSettings.saving")
              : t("ide.bottomPanel.workerSettings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkerSettingsDialog;
