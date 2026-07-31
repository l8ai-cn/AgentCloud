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
import { useSsoActionMessages } from "./ssoActionMessages";

export type SSOAction = "enable" | "disable" | "test" | "delete";
export type SSOTestState = {
  status: "success" | "error";
  message: string;
};

export function useSSOConfigs(search: string, protocol: SSOProtocol | undefined, page: number) {
  const messages = useSsoActionMessages();
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
            error: getErrorMessage(error, messages.loadFailed),
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [messages.loadFailed, page, protocol, requestKey, search]);

  const createConfig = useCallback(async (input: SSOConfigInput) => {
    const key = "create";
    if (!beginMutation(key)) return;
    try {
      await createSSOConfig(input);
      toast.success(messages.created);
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, messages.createFailed));
      throw error;
    } finally {
      endMutation(key);
    }
  }, [beginMutation, endMutation, messages.createFailed, messages.created, reload]);

  const updateConfig = useCallback(async (id: number, input: UpdateSSOConfigInput) => {
    const key = `update:${id}`;
    if (!beginMutation(key)) return;
    try {
      await updateSSOConfig(id, input);
      toast.success(messages.updated);
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, messages.updateFailed));
      throw error;
    } finally {
      endMutation(key);
    }
  }, [beginMutation, endMutation, messages.updateFailed, messages.updated, reload]);

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
          ? { status: "success", message: testResult.message || messages.testPassed }
          : {
              status: "error",
              message: testResult.error || testResult.message || messages.testFailed,
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
      toast.success(messages.success[action]);
      reload();
    } catch (error) {
      const message = getErrorMessage(error, messages.failure[action]);
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
  }, [beginMutation, endMutation, messages, reload]);

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
