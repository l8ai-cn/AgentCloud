"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getSubscription,
  listSubscriptionPlans,
} from "@/lib/api/admin/subscriptions";
import type {
  AdminSubscription,
  AdminSubscriptionPlan,
} from "@/lib/api/admin/subscriptionTypes";
import { getErrorMessage } from "@/lib/utils";

interface SubscriptionResult {
  key: string;
  subscription: AdminSubscription | null;
  plans: AdminSubscriptionPlan[];
  error: string | null;
}

export function useAdminSubscription(orgId: number) {
  const [revision, setRevision] = useState(0);
  const key = `${orgId}\u0000${revision}`;
  const [result, setResult] = useState<SubscriptionResult>({
    key: "",
    subscription: null,
    plans: [],
    error: null,
  });
  const [mutation, setMutation] = useState<string | null>(null);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listSubscriptionPlans(orgId),
      getSubscription(orgId),
    ])
      .then(([plans, subscription]) => {
        if (!controller.signal.aborted) {
          setResult({ key, plans, subscription, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key,
            plans: current.plans,
            subscription: current.subscription,
            error: getErrorMessage(error, "Failed to load subscription."),
          }));
        }
      });
    return () => controller.abort();
  }, [key, orgId]);

  const run = useCallback(async (
    name: string,
    operation: () => Promise<AdminSubscription>,
    successMessage: string,
  ) => {
    setMutation(name);
    try {
      const subscription = await operation();
      setResult((current) => ({ ...current, key, subscription, error: null }));
      toast.success(successMessage);
    } catch (error) {
      toast.error(getErrorMessage(error, "Subscription update failed."));
      throw error;
    } finally {
      setMutation(null);
    }
  }, [key]);

  return {
    subscription: result.subscription,
    plans: result.plans,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    mutation,
    reload,
    run,
  };
}
