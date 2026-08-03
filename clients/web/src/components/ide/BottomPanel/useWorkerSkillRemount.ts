"use client";

import { useCallback, useState } from "react";

import { updatePodSkills, type PodSkillRemountResult } from "@/lib/api/facade/podConnect";
import { getErrorMessage } from "@/lib/utils";
import { usePodStore } from "@/stores/pod";

interface RemountState {
  saving: boolean;
  error: string | null;
  result: PodSkillRemountResult | null;
  remount: (skillIds: number[]) => Promise<boolean>;
  reset: () => void;
}

export function useWorkerSkillRemount(orgSlug: string, podKey: string): RemountState {
  const fetchPod = usePodStore((state) => state.fetchPod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PodSkillRemountResult | null>(null);

  const remount = useCallback(
    async (skillIds: number[]) => {
      setSaving(true);
      setError(null);
      try {
        setResult(await updatePodSkills(orgSlug, podKey, skillIds));
        // The mounted slugs live on the spec snapshot the pod points at, so the
        // projection only refreshes on a refetch.
        await fetchPod(podKey);
        return true;
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to update worker skills"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchPod, orgSlug, podKey],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { saving, error, result, remount, reset };
}
