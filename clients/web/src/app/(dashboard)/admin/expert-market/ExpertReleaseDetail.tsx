"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ExpertRelease } from "@/lib/api/admin/expertMarket";

export function ExpertReleaseDetail({
  release,
  reason,
  busy,
  onReasonChange,
  onApprove,
  onReject,
}: {
  release: ExpertRelease;
  reason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("admin");
  const pending = release.status === "pending";
  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{release.name}</h2>
          <Badge variant="outline">{release.application_slug}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{release.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {release.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Snapshot
          label={t("expertMarket.expertSnapshot")}
          value={release.expert_snapshot_json}
        />
        <Snapshot
          label={t("expertMarket.workerSpec")}
          value={release.worker_spec_snapshot_json}
        />
        <Snapshot
          label={t("expertMarket.skillDependencies")}
          value={release.skill_dependencies_json}
        />
      </div>
      {release.rejection_reason && (
        <p className="text-sm text-destructive">
          {t("expertMarket.rejectionReason", { reason: release.rejection_reason })}
        </p>
      )}
      {pending && (
        <div className="space-y-3">
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={t("expertMarket.rejectionPlaceholder")}
            aria-label={t("expertMarket.rejectionAriaLabel")}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={onApprove}>
              <Check className="mr-2 h-4 w-4" />
              {t("expertMarket.approveRelease")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={onReject}
            >
              <X className="mr-2 h-4 w-4" />
              {t("expertMarket.rejectRelease")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md bg-surface-muted p-3 text-xs">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value || "-";
  }
}
