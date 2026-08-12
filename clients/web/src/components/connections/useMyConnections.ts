"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getLocalizedErrorMessage } from "@/lib/api/errors";
import type { InstalledMcpServer } from "@/lib/api";
import { listRepoMcpServers, uninstallMcpServer, updateMcpServer } from "@/lib/api/facade/repoMcpExtension";
import { useCurrentOrg } from "@/stores/auth";
import { useRepositories, useRepositoryStore } from "@/stores/repository";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export interface MyConnection {
  server: InstalledMcpServer;
  repositoryId: number;
  repositorySlug: string;
  repositoryName: string;
}

// installed_mcp_servers.repository_id is NOT NULL, so user-scoped installs
// must be aggregated per visible repo until the user-dimension RPC lands.
// Swap only this function body; keep MyConnection[] as the return shape.
export async function fetchUserScopedConnections(
  orgSlug: string,
  repositories: { id: number; slug: string; name: string }[],
): Promise<MyConnection[]> {
  const groups = await Promise.all(
    repositories.map(async (repo) => {
      const res = await listRepoMcpServers(orgSlug, repo.id, { scope: "user" });
      return res.items.map((server) => ({
        server,
        repositoryId: repo.id,
        repositorySlug: repo.slug,
        repositoryName: repo.name,
      }));
    }),
  );
  return groups.flat();
}

export function useMyConnections() {
  const t = useTranslations();
  const currentOrg = useCurrentOrg();
  const orgSlug = currentOrg?.slug ?? "";
  const repositories = useRepositories();
  const fetchRepositories = useRepositoryStore((s) => s.fetchRepositories);
  const [connections, setConnections] = useState<MyConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const { dialogProps, confirm } = useConfirmDialog();

  const reload = useCallback(async (mounted?: { current: boolean }) => {
    if (!orgSlug) {
      if (!mounted || mounted.current) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await fetchUserScopedConnections(
        orgSlug,
        repositories.map((repo) => ({ id: repo.id, slug: repo.slug, name: repo.name })),
      );
      if (mounted && !mounted.current) return;
      setConnections(items);
    } catch (error) {
      if (mounted && !mounted.current) return;
      toast.error(getLocalizedErrorMessage(error, t, t("connections.failedToLoad")));
    } finally {
      if (!mounted || mounted.current) setLoading(false);
    }
  }, [orgSlug, repositories, t]);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  useEffect(() => {
    const mounted = { current: true };
    reload(mounted);
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const toggleEnabled = useCallback(async (connection: MyConnection) => {
    if (!orgSlug) return;
    try {
      await updateMcpServer(orgSlug, connection.repositoryId, connection.server.id, {
        isEnabled: !connection.server.is_enabled,
      });
      await reload();
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t, t("connections.failedToUpdate")));
    }
  }, [orgSlug, reload, t]);

  const uninstall = useCallback(async (connection: MyConnection) => {
    if (!orgSlug) return;
    const name = connection.server.name || connection.server.slug;
    const ok = await confirm({
      title: t("connections.confirmUninstall"),
      description: t("connections.uninstallDescription", {
        name,
        repository: connection.repositorySlug,
      }),
      variant: "destructive",
      confirmText: t("connections.uninstall"),
      cancelText: t("connections.cancel"),
    });
    if (!ok) return;
    try {
      await uninstallMcpServer(orgSlug, connection.repositoryId, connection.server.id);
      toast.success(t("connections.uninstalled"));
      await reload();
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t, t("connections.failedToUninstall")));
    }
  }, [orgSlug, confirm, reload, t]);

  return { connections, loading, toggleEnabled, uninstall, dialogProps };
}
