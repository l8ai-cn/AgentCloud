"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { usePodStore } from "@/stores/pod";
import { useWorkspaceStore } from "@/stores/workspace";

// Wake does not restart the stopped Worker — the backend forks a NEW pod from it
// (`source_pod_key`), so every wake surface has to move the pane to the new
// pod_key. Shared by the sidebar menus and the terminal pane.
export function useWakeWorker(): (podKey: string) => Promise<void> {
  const wakePod = usePodStore((s) => s.wakePod);
  const addPane = useWorkspaceStore((s) => s.addPane);
  const removePaneByPodKey = useWorkspaceStore((s) => s.removePaneByPodKey);

  return useCallback(async (podKey: string) => {
    try {
      const resumedPod = await wakePod(podKey);
      removePaneByPodKey(podKey);
      addPane(resumedPod.pod_key);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to wake Worker");
    }
  }, [addPane, removePaneByPodKey, wakePod]);
}
