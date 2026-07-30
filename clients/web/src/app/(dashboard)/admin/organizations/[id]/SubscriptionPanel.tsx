"use client";

import { useState } from "react";
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
  run: () => Promise<void>;
}

export function SubscriptionPanel({ orgId }: { orgId: number }) {
  const { subscription, plans, error, loading, mutation, reload, run } =
    useAdminSubscription(orgId);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const confirm = (
    title: string,
    description: string,
    name: string,
    operation: () => Promise<Awaited<ReturnType<typeof createSubscription>>>,
    success: string,
  ) => setPending({
    title,
    description,
    run: () => run(name, operation, success),
  });

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Subscription</h2>
          {subscription && (
            <Badge variant={subscription.status === "active" ? "success" : "secondary"}>
              {subscription.status}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reload} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
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
            "Create subscription?",
            `Create an active ${plan} subscription for ${months} month(s).`,
            "create",
            () => createSubscription(orgId, plan, months),
            "Subscription created.",
          )}
        />
      ) : (
        <>
          <SubscriptionCoreControls
            subscription={subscription}
            plans={plans}
            mutation={mutation}
            onPlan={(plan) => confirm(
              "Change subscription plan?",
              `Change the plan to ${plan}.`,
              "plan",
              () => updateSubscriptionPlan(orgId, plan),
              "Subscription plan updated.",
            )}
            onSeats={(seats) => confirm(
              "Change seat count?",
              `Set this subscription to ${seats} seats.`,
              "seats",
              () => updateSubscriptionSeats(orgId, seats),
              "Seat count updated.",
            )}
            onCycle={(cycle) => confirm(
              "Change billing cycle?",
              `Change billing to ${cycle}.`,
              "cycle",
              () => updateSubscriptionCycle(orgId, cycle),
              "Billing cycle updated.",
            )}
            onAutoRenew={(enabled) => void run(
              "auto-renew",
              () => setSubscriptionAutoRenew(orgId, enabled),
              `Auto-renew ${enabled ? "enabled" : "disabled"}.`,
            )}
          />
          <SubscriptionLifecycleControls
            status={subscription.status}
            busy={mutation !== null}
            onFreeze={() => confirm("Freeze subscription?", "Execution and paid access may be restricted.", "freeze", () => freezeSubscription(orgId), "Subscription frozen.")}
            onUnfreeze={() => confirm("Unfreeze subscription?", "Restore the subscription to active service.", "unfreeze", () => unfreezeSubscription(orgId), "Subscription unfrozen.")}
            onCancel={() => confirm("Cancel subscription?", "Cancel this subscription and stop future renewals.", "cancel", () => cancelSubscription(orgId), "Subscription canceled.")}
            onRenew={(months) => confirm("Renew subscription?", `Extend the current period by ${months} month(s).`, "renew", () => renewSubscription(orgId, months), "Subscription renewed.")}
          />
          <SubscriptionQuotaControls
            subscription={subscription}
            busy={mutation !== null}
            onSetQuota={(resource, limit) => confirm(
              "Set custom quota?",
              `Override ${resource} with ${limit === -1 ? "unlimited" : limit}.`,
              "quota",
              () => setSubscriptionQuota(orgId, resource, limit),
              "Custom quota updated.",
            )}
          />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmText="Confirm"
        variant={pending?.title.includes("Cancel") ? "destructive" : "default"}
        onConfirm={async () => {
          if (!pending) return;
          await pending.run();
          setPending(null);
        }}
      />
    </section>
  );
}
