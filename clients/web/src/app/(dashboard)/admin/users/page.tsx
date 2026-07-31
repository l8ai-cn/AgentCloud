"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Search, Users } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import type { AdminUser } from "@/lib/api/admin/types";
import { useCurrentUser } from "@/stores/auth";
import { UserRow } from "./UserRow";
import { type UserAction, useAdminUsers } from "./useAdminUsers";

const actionCopy: Record<UserAction, { key: string; destructive: boolean }> = {
  disable: { key: "disable", destructive: true },
  enable: { key: "enable", destructive: false },
  "grant-admin": { key: "grantAdmin", destructive: false },
  "revoke-admin": { key: "revokeAdmin", destructive: true },
  "verify-email": { key: "verifyEmail", destructive: false },
  "unverify-email": { key: "unverifyEmail", destructive: true },
};

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const currentUser = useCurrentUser();
  const { query, setQuery, search, page, setPage } = useSearchPagination();
  const [pending, setPending] = useState<{ user: AdminUser; action: UserAction } | null>(null);
  const { data, loading, error, reload, runAction } = useAdminUsers(search, page);

  const copy = pending ? actionCopy[pending.action] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("nav.users")}
        subtitle={t("users.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("users.searchPlaceholder")}
          className="pl-9"
          aria-label={t("users.searchLabel")}
        />
      </div>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t("users.count", { count: data?.total.toLocaleString() ?? 0 })}
          </h2>
          {loading && <span className="text-xs text-muted-foreground">{t("common.loading")}</span>}
        </div>
        {loading && !data ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : data?.data.length ? (
          data.data.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentUserId={currentUser?.id}
              onAction={(target, action) => setPending({ user: target, action })}
            />
          ))
        ) : (
          <EmptyState
            size="compact"
            icon={<Users className="h-5 w-5" />}
            title={t("users.emptyTitle")}
            description={search ? t("common.tryDifferentSearch") : t("users.emptyDescription")}
          />
        )}
      </section>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.pageOf", { page: data.page, total: data.total_pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy ? t(`users.confirm.${copy.key}.title`) : ""}
        description={
          pending && copy
            ? `${t(`users.confirm.${copy.key}.description`)} ${t("users.confirmTarget", { email: pending.user.email })}`
            : undefined
        }
        variant={copy?.destructive ? "destructive" : "default"}
        confirmText={t("common.confirm")}
        onConfirm={async () => {
          if (!pending) return;
          await runAction(pending.action, pending.user.id);
          setPending(null);
        }}
      />
    </div>
  );
}
