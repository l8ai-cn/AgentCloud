"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { SSOConfig, SSOProtocol } from "@/lib/api/admin/sso";
import { SsoConfigList } from "./SsoConfigList";
import { SsoFormDialog } from "./SsoFormDialog";
import { type SSOAction, useSSOConfigs } from "./useSSOConfigs";

const actionCopy: Record<Exclude<SSOAction, "test">, {
  title: string;
  description: string;
  confirmText: string;
  destructive: boolean;
}> = {
  enable: {
    title: "Enable this SSO configuration?",
    description: "Users with the matching domain can use this identity provider.",
    confirmText: "Enable",
    destructive: false,
  },
  disable: {
    title: "Disable this SSO configuration?",
    description: "New sign-ins through this identity provider will stop.",
    confirmText: "Disable",
    destructive: true,
  },
  delete: {
    title: "Delete this SSO configuration?",
    description: "This permanently removes the provider configuration and cannot be undone.",
    confirmText: "Delete",
    destructive: true,
  },
};

type ConfirmedAction = Exclude<SSOAction, "test">;

export default function AdminSSOPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState<SSOProtocol | undefined>();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SSOConfig | null>(null);
  const [pending, setPending] = useState<{
    config: SSOConfig;
    action: ConfirmedAction;
  } | null>(null);
  const sso = useSSOConfigs(search, protocol, page);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const copy = pending ? actionCopy[pending.action] : null;
  const configs = sso.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Single sign-on"
        subtitle="Configure domain-specific OIDC, SAML, and LDAP identity providers."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={sso.reload} loading={sso.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by domain or display name"
            className="pl-9"
            aria-label="Search SSO configurations"
          />
        </div>
        <Select
          value={protocol ?? "all"}
          onValueChange={(value) => {
            setProtocol(value === "all" ? undefined : value as SSOProtocol);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by protocol">
            <span>{protocol ? protocol.toUpperCase() : "All protocols"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All protocols</SelectItem>
            <SelectItem value="oidc">OIDC</SelectItem>
            <SelectItem value="saml">SAML</SelectItem>
            <SelectItem value="ldap">LDAP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sso.error && <AlertMessage type="error" message={sso.error} />}

      <SsoConfigList
        configs={configs}
        total={sso.data?.total ?? 0}
        loading={sso.loading}
        searchActive={Boolean(search || protocol)}
        mutationKey={sso.mutationKey}
        testResults={sso.testResults}
        onEdit={(config) => {
          setEditing(config);
          setFormOpen(true);
        }}
        onAction={(config, action) => {
          if (action === "test") void sso.runAction(action, config);
          else setPending({ config, action });
        }}
      />

      {sso.data && sso.data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {sso.data.page} of {sso.data.total_pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || sso.loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= sso.data.total_pages || sso.loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <SsoFormDialog
        open={formOpen}
        config={editing}
        onOpenChange={setFormOpen}
        onCreate={sso.createConfig}
        onUpdate={sso.updateConfig}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ""}
        description={pending ? `${copy?.description} Target: ${pending.config.domain}` : undefined}
        confirmText={copy?.confirmText}
        variant={copy?.destructive ? "destructive" : "default"}
        onConfirm={async () => {
          if (!pending) return;
          await sso.runAction(pending.action, pending.config);
          setPending(null);
        }}
      />
    </div>
  );
}
