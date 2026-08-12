"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { McpMarketItem } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/lib/api/errors";
import { installMcpFromMarket } from "@/lib/api/facade/repoMcpExtension";
import { useCurrentOrg } from "@/stores/auth";
import { RepositorySelect } from "@/components/common/RepositorySelect";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ConnectionEnvVarFields,
  filledEnvVars,
  hasUnfilledRequiredEnvVars,
} from "./ConnectionEnvVarFields";

interface ConnectionInstallDialogProps {
  item: McpMarketItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionInstallDialog({ item, open, onOpenChange }: ConnectionInstallDialogProps) {
  const t = useTranslations();
  const currentOrg = useCurrentOrg();
  const orgSlug = currentOrg?.slug ?? "";
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [scope, setScope] = useState<"org" | "user">("user");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);

  const schema = item?.env_var_schema ?? [];

  useEffect(() => {
    if (!open || !item) return;
    const defaults: Record<string, string> = {};
    for (const entry of item.env_var_schema ?? []) defaults[entry.name] = "";
    setEnvVars(defaults);
  }, [open, item]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRepositoryId(null);
      setScope("user");
      setEnvVars({});
    }
    onOpenChange(next);
  };

  const handleInstall = async () => {
    if (!item || !orgSlug || repositoryId == null) return;
    setInstalling(true);
    try {
      await installMcpFromMarket(orgSlug, repositoryId, {
        marketItemId: item.id,
        scope,
        envVars: filledEnvVars(envVars),
      });
      toast.success(t("connections.installed"));
      handleOpenChange(false);
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t, t("connections.failedToInstall")));
    } finally {
      setInstalling(false);
    }
  };

  const name = item?.name || item?.slug || "";
  const blocked = installing || repositoryId == null || hasUnfilledRequiredEnvVars(schema, envVars);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connections.installTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("connections.installDescription", { name })}
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("connections.targetRepository")}</label>
            <RepositorySelect
              value={repositoryId}
              onChange={(id) => setRepositoryId(id)}
              placeholder={t("connections.selectRepository")}
              disabled={installing}
            />
          </div>
          <div>
            <label htmlFor="connection-scope" className="text-sm font-medium mb-1 block">
              {t("connections.installScope")}
            </label>
            <select
              id="connection-scope"
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              value={scope}
              onChange={(e) => setScope(e.target.value as "org" | "user")}
              disabled={installing}
            >
              <option value="user">{t("connections.scopeUser")}</option>
              <option value="org">{t("connections.scopeOrg")}</option>
            </select>
          </div>
          <ConnectionEnvVarFields
            schema={schema}
            values={envVars}
            onChange={(key, value) => setEnvVars((prev) => ({ ...prev, [key]: value }))}
            disabled={installing}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={installing}>
            {t("connections.cancel")}
          </Button>
          <Button onClick={handleInstall} disabled={blocked}>
            {installing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("connections.installing")}
              </>
            ) : (
              t("connections.install")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
