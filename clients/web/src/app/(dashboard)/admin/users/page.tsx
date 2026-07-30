"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { AdminUser } from "@/lib/api/admin/types";
import { useCurrentUser } from "@/stores/auth";
import { UserRow } from "./UserRow";
import { type UserAction, useAdminUsers } from "./useAdminUsers";

const actionCopy: Record<UserAction, { title: string; description: string; destructive: boolean }> = {
  disable: {
    title: "Disable this account?",
    description: "The user will be blocked from signing in until the account is enabled again.",
    destructive: true,
  },
  enable: { title: "Enable this account?", description: "The user can sign in again.", destructive: false },
  "grant-admin": {
    title: "Grant system administrator access?",
    description: "This user will be able to manage all platform accounts and organizations.",
    destructive: false,
  },
  "revoke-admin": {
    title: "Revoke system administrator access?",
    description: "The user will immediately lose access to system administration.",
    destructive: true,
  },
  "verify-email": { title: "Mark email as verified?", description: "Use only after independently confirming ownership.", destructive: false },
  "unverify-email": {
    title: "Remove email verification?",
    description: "The account will return to an unverified email state.",
    destructive: true,
  },
};

export default function AdminUsersPage() {
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ user: AdminUser; action: UserAction } | null>(null);
  const { data, loading, error, reload, runAction } = useAdminUsers(search, page);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const copy = pending ? actionCopy[pending.action] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Users"
        subtitle="Manage account access, email verification, and system administrator privileges."
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email, username, or name"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{data?.total.toLocaleString() ?? 0} users</h2>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
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
            title="No users found"
            description={search ? "Try a different search." : "No user accounts exist yet."}
          />
        )}
      </section>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ""}
        description={pending ? `${copy?.description} Target: ${pending.user.email}` : undefined}
        variant={copy?.destructive ? "destructive" : "default"}
        confirmText="Confirm"
        onConfirm={async () => {
          if (!pending) return;
          await runAction(pending.action, pending.user.id);
          setPending(null);
        }}
      />
    </div>
  );
}
