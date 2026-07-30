"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createSSOConfig,
  deleteSSOConfig,
  disableSSOConfig,
  enableSSOConfig,
  listSSOConfigs,
  testSSOConnection,
  updateSSOConfig,
  type SSOConfig,
  type SSOConfigInput,
  type SSOProtocol,
  type UpdateSSOConfigInput,
} from "@/lib/api/admin/sso";
import type { AdminPaginated } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

export type SSOAction = "enable" | "disable" | "test" | "delete";
export type SSOTestState = {
  status: "success" | "error";
  message: string;
};

export function useSSOConfigs(search: string, protocol: SSOProtocol | undefined, page: number) {
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([search, protocol, page, revision]);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const activeMutationKey = useRef<string | null>(null);
  const [testResults, setTestResults] = useState<Record<number, SSOTestState>>({});
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<SSOConfig> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const beginMutation = useCallback((key: string) => {
    if (activeMutationKey.current !== null) return false;
    activeMutationKey.current = key;
    setMutationKey(key);
    return true;
  }, []);
  const endMutation = useCallback((key: string) => {
    if (activeMutationKey.current !== key) return;
    activeMutationKey.current = null;
    setMutationKey(null);
  }, []);

  useEffect(() => {
    let active = true;
    listSSOConfigs({ search: search || undefined, protocol, page, page_size: 20 })
      .then((data) => {
        if (active) setResult({ key: requestKey, data, error: null });
      })
      .catch((error) => {
        if (active) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(error, "Failed to load SSO configurations."),
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [page, protocol, requestKey, search]);

  const createConfig = useCallback(async (input: SSOConfigInput) => {
    const key = "create";
    if (!beginMutation(key)) return;
    try {
      await createSSOConfig(input);
      toast.success("SSO configuration created.");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create SSO configuration."));
      throw error;
    } finally {
      endMutation(key);
    }
  }, [beginMutation, endMutation, reload]);

  const updateConfig = useCallback(async (id: number, input: UpdateSSOConfigInput) => {
    const key = `update:${id}`;
    if (!beginMutation(key)) return;
    try {
      await updateSSOConfig(id, input);
      toast.success("SSO configuration updated.");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update SSO configuration."));
      throw error;
    } finally {
      endMutation(key);
    }
  }, [beginMutation, endMutation, reload]);

  const runAction = useCallback(async (action: SSOAction, config: SSOConfig) => {
    const key = `${action}:${config.id}`;
    if (!beginMutation(key)) return;
    if (action === "test") {
      setTestResults((current) => {
        const next = { ...current };
        delete next[config.id];
        return next;
      });
    }
    try {
      if (action === "test") {
        const testResult = await testSSOConnection(config.id);
        const state: SSOTestState = testResult.success
          ? { status: "success", message: testResult.message || "Connection test passed." }
          : {
              status: "error",
              message: testResult.error || testResult.message || "Connection test failed.",
            };
        setTestResults((current) => ({ ...current, [config.id]: state }));
        if (testResult.success) {
          toast.success(state.message);
        } else {
          toast.error(state.message);
        }
        return;
      }
      if (action === "enable") await enableSSOConfig(config.id);
      if (action === "disable") await disableSSOConfig(config.id);
      if (action === "delete") await deleteSSOConfig(config.id);
      toast.success(action === "delete" ? "SSO configuration deleted." : `SSO configuration ${action}d.`);
      reload();
    } catch (error) {
      const message = getErrorMessage(error, `Failed to ${action} SSO configuration.`);
      if (action === "test") {
        setTestResults((current) => ({
          ...current,
          [config.id]: { status: "error", message },
        }));
      }
      toast.error(message);
      if (action !== "test") throw error;
    } finally {
      endMutation(key);
    }
  }, [beginMutation, endMutation, reload]);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    mutationKey,
    testResults,
    reload,
    createConfig,
    updateConfig,
    runAction,
  };
}
