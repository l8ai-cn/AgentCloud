"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, RefreshCw } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  cancelSubscription,
  createSubscription,
  freezeSubscription,
  renewSubscription,
  setSubscriptionAutoRenew,
  setSubscriptionQuota,
  unfreezeSubscription,
  updateSubscriptionCycle,
  updateSubscriptionPlan,
  updateSubscriptionSeats,
} from "@/lib/api/admin/subscriptions";
import { CreateSubscriptionPanel } from "./CreateSubscriptionPanel";
import { SubscriptionCoreControls } from "./SubscriptionCoreControls";
import { SubscriptionLifecycleControls } from "./SubscriptionLifecycleControls";
import { SubscriptionQuotaControls } from "./SubscriptionQuotaControls";
import { useAdminSubscription } from "./useAdminSubscription";

interface PendingAction {
  title: string;
  description: string;
  destructive?: boolean;
  run: () => Promise<void>;
}

export function SubscriptionPanel({ orgId }: { orgId: number }) {
  const t = useTranslations("admin");
  const { subscription, plans, error, loading, mutation, reload, run } =
    useAdminSubscription(orgId);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const confirm = (
    title: string,
    description: string,
    name: string,
    operation: () => Promise<Awaited<ReturnType<typeof createSubscription>>>,
    success: string,
    destructive?: boolean,
  ) => setPending({
    title,
    description,
    destructive,
    run: () => run(name, operation, success),
  });

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t("subscription.title")}</h2>
          {subscription && (
            <Badge variant={subscription.status === "active" ? "success" : "secondary"}>
              {subscription.status}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reload} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.refresh")}
        </Button>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {loading && !subscription ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-muted" />
      ) : !subscription ? (
        <CreateSubscriptionPanel
          plans={plans}
          busy={mutation !== null}
          onCreate={(plan, months) => confirm(
            t("subscription.createTitle"),
            t("subscription.createDescription", { plan, months }),
            "create",
            () => createSubscription(orgId, plan, months),
            t("subscription.createSuccess"),
          )}
        />
      ) : (
        <>
          <SubscriptionCoreControls
            subscription={subscription}
            plans={plans}
            mutation={mutation}
            onPlan={(plan) => confirm(
              t("subscription.changePlanTitle"),
              t("subscription.changePlanDescription", { plan }),
              "plan",
              () => updateSubscriptionPlan(orgId, plan),
              t("subscription.planUpdated"),
            )}
            onSeats={(seats) => confirm(
              t("subscription.changeSeatsTitle"),
              t("subscription.changeSeatsDescription", { seats }),
              "seats",
              () => updateSubscriptionSeats(orgId, seats),
              t("subscription.seatsUpdated"),
            )}
            onCycle={(cycle) => confirm(
              t("subscription.changeCycleTitle"),
              t("subscription.changeCycleDescription", { cycle }),
              "cycle",
              () => updateSubscriptionCycle(orgId, cycle),
              t("subscription.cycleUpdated"),
            )}
            onAutoRenew={(enabled) => void run(
              "auto-renew",
              () => setSubscriptionAutoRenew(orgId, enabled),
              enabled
                ? t("subscription.autoRenewEnabled")
                : t("subscription.autoRenewDisabled"),
            )}
          />
          <SubscriptionLifecycleControls
            status={subscription.status}
            busy={mutation !== null}
            onFreeze={() => confirm(
              t("subscription.freezeTitle"),
              t("subscription.freezeDescription"),
              "freeze",
              () => freezeSubscription(orgId),
              t("subscription.freezeSuccess"),
            )}
            onUnfreeze={() => confirm(
              t("subscription.unfreezeTitle"),
              t("subscription.unfreezeDescription"),
              "unfreeze",
              () => unfreezeSubscription(orgId),
              t("subscription.unfreezeSuccess"),
            )}
            onCancel={() => confirm(
              t("subscription.cancelTitle"),
              t("subscription.cancelDescription"),
              "cancel",
              () => cancelSubscription(orgId),
              t("subscription.cancelSuccess"),
              true,
            )}
            onRenew={(months) => confirm(
              t("subscription.renewTitle"),
              t("subscription.renewDescription", { months }),
              "renew",
              () => renewSubscription(orgId, months),
              t("subscription.renewSuccess"),
            )}
          />
          <SubscriptionQuotaControls
            subscription={subscription}
            busy={mutation !== null}
            onSetQuota={(resource, limit) => confirm(
              t("subscription.quotaTitle"),
              t("subscription.quotaDescription", {
                resource,
                limit: limit === -1 ? t("subscription.unlimited") : String(limit),
              }),
              "quota",
              () => setSubscriptionQuota(orgId, resource, limit),
              t("subscription.quotaUpdated"),
            )}
          />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmText={t("common.confirm")}
        variant={pending?.destructive ? "destructive" : "default"}
        onConfirm={async () => {
          if (!pending) return;
          await pending.run();
          setPending(null);
        }}
      />
    </section>
  );
}
