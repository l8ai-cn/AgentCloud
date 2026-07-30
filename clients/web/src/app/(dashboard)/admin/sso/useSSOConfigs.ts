"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useSSOConfigs(search: string, protocol: SSOProtocol | undefined, page: number) {
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([search, protocol, page, revision]);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<SSOConfig> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

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
    setMutationKey("create");
    try {
      await createSSOConfig(input);
      toast.success("SSO configuration created.");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create SSO configuration."));
      throw error;
    } finally {
      setMutationKey(null);
    }
  }, [reload]);

  const updateConfig = useCallback(async (id: number, input: UpdateSSOConfigInput) => {
    setMutationKey(`update:${id}`);
    try {
      await updateSSOConfig(id, input);
      toast.success("SSO configuration updated.");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update SSO configuration."));
      throw error;
    } finally {
      setMutationKey(null);
    }
  }, [reload]);

  const runAction = useCallback(async (action: SSOAction, config: SSOConfig) => {
    setMutationKey(`${action}:${config.id}`);
    try {
      if (action === "test") {
        const testResult = await testSSOConnection(config.id);
        if (testResult.success) {
          toast.success(testResult.message || "Connection test passed.");
        } else {
          toast.error(testResult.error || testResult.message || "Connection test failed.");
        }
        return;
      }
      if (action === "enable") await enableSSOConfig(config.id);
      if (action === "disable") await disableSSOConfig(config.id);
      if (action === "delete") await deleteSSOConfig(config.id);
      toast.success(action === "delete" ? "SSO configuration deleted." : `SSO configuration ${action}d.`);
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, `Failed to ${action} SSO configuration.`));
      throw error;
    } finally {
      setMutationKey(null);
    }
  }, [reload]);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    mutationKey,
    reload,
    createConfig,
    updateConfig,
    runAction,
  };
}
