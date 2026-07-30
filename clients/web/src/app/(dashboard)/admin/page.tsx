"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Building2,
  RefreshCw,
  Server,
  UserPlus,
  Users,
} from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardStats } from "@/lib/api/admin/dashboard";
import type { DashboardStats } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getDashboardStats());
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load system statistics."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="System administration"
        subtitle="Operational status across accounts, organizations, and execution capacity."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <AlertMessage type="error" message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !stats
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-md bg-surface-muted" />
            ))
          : stats && (
              <>
                <StatCard
                  title="Users"
                  value={stats.total_users}
                  detail={`${stats.active_users.toLocaleString()} active`}
                  icon={Users}
                />
                <StatCard
                  title="Organizations"
                  value={stats.total_organizations}
                  detail={`${stats.active_subscriptions.toLocaleString()} active subscriptions`}
                  icon={Building2}
                />
                <StatCard
                  title="Runners"
                  value={stats.total_runners}
                  detail={`${stats.online_runners.toLocaleString()} online`}
                  icon={Server}
                />
                <StatCard
                  title="Active pods"
                  value={stats.active_pods}
                  detail={`${stats.total_pods.toLocaleString()} total`}
                  icon={Activity}
                />
              </>
            )}
      </div>

      {stats && (
        <section className="border-t border-border pt-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">User growth</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Today", stats.new_users_today],
              ["Last 7 days", stats.new_users_this_week],
              ["Last month", stats.new_users_this_month],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-l-2 border-primary/50 pl-4">
                <p className="text-2xl font-semibold">{Number(value).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
