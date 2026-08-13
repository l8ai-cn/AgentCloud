"use client";

import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ResourceGrant } from "@/lib/api";

interface ShareGrantListProps {
  grants: ResourceGrant[];
  loading: boolean;
  onRevoke: (grantId: number) => void;
}

export function ShareGrantList({ grants, loading, onRevoke }: ShareGrantListProps) {
  const t = useTranslations("share");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (grants.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{t("noAllowList")}</p>;
  }

  return (
    <>
      {grants.map((grant) => (
        <div
          key={grant.id}
          className="flex items-center justify-between rounded px-2 py-2 hover:bg-muted/50"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {(grant.user?.name || grant.user?.username || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {grant.user?.name || grant.user?.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">{grant.user?.email}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-destructive"
            aria-label={t("revoke")}
            onClick={() => onRevoke(grant.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </>
  );
}
