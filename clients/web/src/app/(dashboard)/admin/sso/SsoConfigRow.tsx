"use client";

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
  const rowBusy = mutationKey !== null;
  const testing = mutationKey === `test:${config.id}`;
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{config.name}</p>
          <Badge variant="outline">{config.protocol.toUpperCase()}</Badge>
          <Badge variant={config.is_enabled ? "success" : "secondary"}>
            {config.is_enabled ? "Enabled" : "Disabled"}
          </Badge>
          {config.enforce_sso && (
            <Badge variant="warning" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Enforced
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{config.domain}</p>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>
          {config.default_organization_id
            ? `Default org #${config.default_organization_id}`
            : "No default organization"}
        </p>
        <p>Updated {new Date(config.updated_at).toLocaleString()}</p>
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
          label={`Edit ${config.name}`}
          title="Edit configuration"
          disabled={rowBusy}
          icon={<Pencil className="h-4 w-4" />}
          onClick={() => onEdit(config)}
        />
        <ActionButton
          label={`${config.is_enabled ? "Disable" : "Enable"} ${config.name}`}
          title={config.is_enabled ? "Disable configuration" : "Enable configuration"}
          busy={mutationKey === `${config.is_enabled ? "disable" : "enable"}:${config.id}`}
          disabled={rowBusy}
          icon={config.is_enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          onClick={() => onAction(config, config.is_enabled ? "disable" : "enable")}
        />
        <ActionButton
          label={`Delete ${config.name}`}
          title="Delete configuration"
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
  const content = testing
    ? { icon: <LoaderCircle className="h-4 w-4 animate-spin" />, label: "Testing" }
    : result?.status === "success"
      ? { icon: <CircleCheck className="h-4 w-4 text-success" />, label: "Passed" }
      : result?.status === "error"
        ? { icon: <CircleX className="h-4 w-4 text-destructive" />, label: "Failed" }
        : { icon: <FlaskConical className="h-4 w-4" />, label: "Test" };

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`Test ${configName}`}
      title="Test connection"
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
