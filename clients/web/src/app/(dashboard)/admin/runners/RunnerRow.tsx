"use client";

import { Power, PowerOff, Server, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminRunner } from "@/lib/api/admin/runners";
import type { RunnerAction } from "./useAdminRunners";

interface RunnerRowProps {
  runner: AdminRunner;
  disabled?: boolean;
  onAction: (runner: AdminRunner, action: RunnerAction) => void;
}

export function RunnerRow({ runner, disabled, onAction }: RunnerRowProps) {
  const isOnline = runner.status === "online";

  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(11rem,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
          <Server className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{runner.node_id}</p>
            <Badge variant={isOnline ? "success" : "secondary"}>{runner.status}</Badge>
            {!runner.is_enabled && <Badge variant="destructive">Disabled</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {runner.organization ? runner.organization.name : `Org #${runner.organization_id}`}
            {runner.runner_version ? ` · v${runner.runner_version}` : ""}
            {` · ${runner.current_pods}/${runner.max_concurrent_pods} pods`}
            {runner.available_agents.length > 0
              ? ` · ${runner.available_agents.length} agents`
              : ""}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>
          {runner.last_heartbeat
            ? `Last heartbeat ${new Date(runner.last_heartbeat).toLocaleString()}`
            : "No heartbeat recorded"}
        </p>
        <p>Registered {new Date(runner.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex gap-1">
        {runner.is_enabled ? (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Disable ${runner.node_id}`}
            title="Disable runner"
            onClick={() => onAction(runner, "disable")}
          >
            <PowerOff className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Enable ${runner.node_id}`}
            title="Enable runner"
            onClick={() => onAction(runner, "enable")}
          >
            <Power className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Delete ${runner.node_id}`}
          title="Delete runner"
          className="text-destructive hover:text-destructive"
          onClick={() => onAction(runner, "delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
