"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, RefreshCw, Search } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import type { SSOConfig, SSOProtocol } from "@/lib/api/admin/sso";
import { SsoConfigList } from "./SsoConfigList";
import { SsoFormDialog } from "./SsoFormDialog";
import { useSsoConfirmCopy, type SSOConfirmAction } from "./ssoConfirmCopy";
import { useSSOConfigs } from "./useSSOConfigs";

export default function AdminSSOPage() {
  const t = useTranslations("admin");
  const confirmCopy = useSsoConfirmCopy();
  const { query, setQuery, search, page, setPage } = useSearchPagination();
  const [protocol, setProtocol] = useState<SSOProtocol | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SSOConfig | null>(null);
  const [pending, setPending] = useState<{
    config: SSOConfig;
    action: SSOConfirmAction;
  } | null>(null);
  const sso = useSSOConfigs(search, protocol, page);

  const copy = pending ? confirmCopy(pending.action, pending.config.domain) : null;
  const configs = sso.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("sso.title")}
        subtitle={t("sso.subtitle")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={sso.reload} loading={sso.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("sso.create")}
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
            placeholder={t("sso.searchPlaceholder")}
            className="pl-9"
            aria-label={t("sso.searchAria")}
          />
        </div>
        <Select
          value={protocol ?? "all"}
          onValueChange={(value) => {
            setProtocol(value === "all" ? undefined : value as SSOProtocol);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label={t("sso.filterProtocolAria")}>
            <span>{protocol ? protocol.toUpperCase() : t("sso.allProtocols")}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sso.allProtocols")}</SelectItem>
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
            {t("common.pageOf", { page: sso.data.page, total: sso.data.total_pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || sso.loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= sso.data.total_pages || sso.loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</Button>
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
        description={copy?.description}
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
