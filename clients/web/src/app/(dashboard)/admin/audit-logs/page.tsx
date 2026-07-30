"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listAuditLogs } from "@/lib/api/admin/auditLogs";
import type { AdminPaginated, AuditLog } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";
import { AuditLogRow } from "./AuditLogRow";

const FILTERS: { label: string; value?: string }[] = [
  { label: "All", value: undefined },
  { label: "Users", value: "user" },
  { label: "Organizations", value: "organization" },
  { label: "Runners", value: "runner" },
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState<string | undefined>();
  const [revision, setRevision] = useState(0);
  const requestKey = `${targetType ?? "all"}\u0000${page}\u0000${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<AuditLog> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const isLoading = result.key !== requestKey;
  const data = result.data;
  const error = result.key === requestKey ? result.error : null;

  useEffect(() => {
    let cancelled = false;
    listAuditLogs({ page, page_size: 50, target_type: targetType })
      .then((result) => {
        if (!cancelled) {
          setResult({ key: requestKey, data: result, error: null });
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(loadError, "Failed to load audit logs."),
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, requestKey, targetType]);

  return (
    <div className="space-y-4">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Audit logs"
        subtitle="Review system administrator actions across protected resources."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevision((value) => value + 1)}
            loading={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <AlertMessage type="error" message={error} />}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={targetType === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTargetType(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs ({data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.data.map((log) => (
                <AuditLogRow key={log.id} log={log} />
              ))}
              {data?.data.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No audit logs
                </p>
              )}
            </div>
          )}

          {data && data.total_pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.page} / {data.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.total_pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
