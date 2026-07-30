import { KeyRound } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { SSOConfig } from "@/lib/api/admin/sso";
import { SsoConfigRow } from "./SsoConfigRow";
import type { SSOAction, SSOTestState } from "./useSSOConfigs";

export function SsoConfigList({
  configs,
  total,
  loading,
  searchActive,
  mutationKey,
  testResults,
  onEdit,
  onAction,
}: {
  configs: SSOConfig[];
  total: number;
  loading: boolean;
  searchActive: boolean;
  mutationKey: string | null;
  testResults: Record<number, SSOTestState>;
  onEdit: (config: SSOConfig) => void;
  onAction: (config: SSOConfig, action: SSOAction) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{total.toLocaleString()} configurations</h2>
        {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>
      {loading && configs.length === 0 ? (
        <div className="space-y-1 p-4" aria-label="Loading SSO configurations">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      ) : configs.length > 0 ? (
        configs.map((config) => (
          <SsoConfigRow
            key={config.id}
            config={config}
            mutationKey={mutationKey}
            testResult={testResults[config.id]}
            onEdit={onEdit}
            onAction={onAction}
          />
        ))
      ) : (
        <EmptyState
          size="compact"
          icon={<KeyRound className="h-5 w-5" />}
          title="No SSO configurations found"
          description={
            searchActive
              ? "Try a different search or protocol filter."
              : "Create a configuration to enable domain-specific sign-in."
          }
        />
      )}
    </section>
  );
}
