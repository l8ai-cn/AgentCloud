"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTicketPods } from "@/hooks/useTicketPods";
import { useAuthStore } from "@/stores/auth";
import { Terminal, Plus } from "lucide-react";
import { CreatePodModal } from "@/components/ide/CreatePodModal";
import { isPodActive } from "@/lib/pod-status";
import { buildTicketContext } from "./buildTicketContext";
import { TicketPodItem } from "./TicketPodItem";

interface TicketPodPanelProps {
  ticketSlug: string;
  ticketTitle: string;
  ticketId?: number;
  ticketContent?: string;
  repositoryId?: number;
  onPodCreated?: () => void;
}

export default function TicketPodPanel({
  ticketSlug,
  ticketTitle,
  ticketId,
  ticketContent,
  repositoryId,
  onPodCreated,
}: TicketPodPanelProps) {
  const t = useTranslations();
  const { pods, ready, refresh } = useTicketPods(ticketSlug);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchPods = useCallback(async () => {
    try {
      await refresh();
    } catch (err: unknown) {
      console.error("Failed to fetch pods:", err);
    }
  }, [refresh]);

  const handlePodCreated = () => {
    setShowCreateForm(false);
    fetchPods();
    onPodCreated?.();
  };

  const handleCloseModal = () => {
    setShowCreateForm(false);
  };

  const activePods = useMemo(() => pods.filter(
    (s) => isPodActive(s.status)
  ), [pods]);
  const inactivePods = useMemo(() => pods.filter(
    (s) => !isPodActive(s.status)
  ), [pods]);

  if (!ready) {
    return (
      <div className="p-4 surface-card">
        <div className="flex items-center justify-center py-8">
          <Spinner size="sm" />
        </div>
      </div>
    );
  }

  return (
    <>
      <CreatePodModal
        open={showCreateForm}
        onClose={handleCloseModal}
        onCreated={handlePodCreated}
        ticketContext={buildTicketContext(
          {
            id: ticketId,
            title: ticketTitle,
            content: ticketContent,
            repository_id: repositoryId,
          },
          ticketSlug,
        )}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              AgentPods
            </span>
            {activePods.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-success-bg text-success">
                {activePods.length} {t("tickets.podPanel.active")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t("tickets.podPanel.newPod")}
          </Button>
        </div>

        <div className="space-y-1">
        {activePods.map((pod) => (
          <TicketPodItem key={pod.pod_key} pod={pod} />
        ))}

          {inactivePods.length > 0 && (
            <details className="group">
              <summary className="px-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer motion-interactive hover:bg-surface-muted rounded-md">
                {t("tickets.podPanel.previousPods", { count: inactivePods.length })}
              </summary>
              <div className="mt-1 space-y-1">
                {inactivePods.map((pod) => (
                  <TicketPodItem key={pod.pod_key} pod={pod} />
                ))}
              </div>
            </details>
          )}

          {pods.length === 0 && (
            <div className="py-4 text-center text-muted-foreground">
              <Terminal className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs">{t("tickets.podPanel.noPods")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
