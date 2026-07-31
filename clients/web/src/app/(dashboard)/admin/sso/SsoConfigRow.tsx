"use client";

import { useTranslations } from "next-intl";
import {
  CircleCheck,
  CircleX,
  FlaskConical,
  LoaderCircle,
  Pencil,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SSOConfig } from "@/lib/api/admin/sso";
import type { SSOAction, SSOTestState } from "./useSSOConfigs";

export function SsoConfigRow({
  config,
  mutationKey,
  testResult,
  onEdit,
  onAction,
}: {
  config: SSOConfig;
  mutationKey: string | null;
  testResult?: SSOTestState;
  onEdit: (config: SSOConfig) => void;
  onAction: (config: SSOConfig, action: SSOAction) => void;
}) {
  const t = useTranslations("admin");
  const rowBusy = mutationKey !== null;
  const testing = mutationKey === `test:${config.id}`;
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{config.name}</p>
          <Badge variant="outline">{config.protocol.toUpperCase()}</Badge>
          <Badge variant={config.is_enabled ? "success" : "secondary"}>
            {config.is_enabled ? t("common.enabled") : t("common.disabled")}
          </Badge>
          {config.enforce_sso && (
            <Badge variant="warning" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {t("sso.enforced")}
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{config.domain}</p>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>
          {config.default_organization_id
            ? t("sso.defaultOrganization", { id: String(config.default_organization_id) })
            : t("sso.noDefaultOrganization")}
        </p>
        <p>{t("sso.updatedAt", { timestamp: new Date(config.updated_at).toLocaleString() })}</p>
        {testResult && (
          <p
            role={testResult.status === "error" ? "alert" : "status"}
            className={testResult.status === "success" ? "text-success" : "text-destructive"}
          >
            {testResult.message}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <TestButton
          configName={config.name}
          testing={testing}
          result={testResult}
          disabled={rowBusy}
          onClick={() => onAction(config, "test")}
        />
        <ActionButton
          label={t("sso.row.editAria", { name: config.name })}
          title={t("sso.row.editTitle")}
          disabled={rowBusy}
          icon={<Pencil className="h-4 w-4" />}
          onClick={() => onEdit(config)}
        />
        <ActionButton
          label={config.is_enabled
            ? t("sso.row.disableAria", { name: config.name })
            : t("sso.row.enableAria", { name: config.name })}
          title={config.is_enabled ? t("sso.row.disableTitle") : t("sso.row.enableTitle")}
          busy={mutationKey === `${config.is_enabled ? "disable" : "enable"}:${config.id}`}
          disabled={rowBusy}
          icon={config.is_enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          onClick={() => onAction(config, config.is_enabled ? "disable" : "enable")}
        />
        <ActionButton
          label={t("sso.row.deleteAria", { name: config.name })}
          title={t("sso.row.deleteTitle")}
          busy={mutationKey === `delete:${config.id}`}
          disabled={rowBusy}
          destructive
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => onAction(config, "delete")}
        />
      </div>
    </div>
  );
}

function TestButton({
  configName,
  testing,
  result,
  disabled,
  onClick,
}: {
  configName: string;
  testing: boolean;
  result?: SSOTestState;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("admin");
  const content = testing
    ? { icon: <LoaderCircle className="h-4 w-4 animate-spin" />, label: t("sso.test.testing") }
    : result?.status === "success"
      ? { icon: <CircleCheck className="h-4 w-4 text-success" />, label: t("sso.test.passed") }
      : result?.status === "error"
        ? { icon: <CircleX className="h-4 w-4 text-destructive" />, label: t("sso.test.failed") }
        : { icon: <FlaskConical className="h-4 w-4" />, label: t("sso.test.idle") };

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("sso.test.buttonAria", { name: configName })}
      title={t("sso.test.buttonTitle")}
      disabled={disabled}
      className="min-w-[5.5rem] gap-1.5"
      onClick={onClick}
    >
      {content.icon}
      {content.label}
    </Button>
  );
}

function ActionButton({
  label,
  title,
  icon,
  busy = false,
  disabled = false,
  destructive = false,
  onClick,
}: {
  label: string;
  title: string;
  icon: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={title}
      disabled={disabled}
      className={destructive ? "text-destructive hover:text-destructive" : undefined}
      onClick={onClick}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
    </Button>
  );
}
