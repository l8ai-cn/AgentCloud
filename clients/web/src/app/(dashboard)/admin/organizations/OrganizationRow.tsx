import Link from "next/link";
import { ArrowUpRight, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminOrganization } from "@/lib/api/admin/organizations";

export function OrganizationRow({
  organization,
  onDelete,
}: {
  organization: AdminOrganization;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{organization.name}</p>
          <Badge variant="outline">{organization.slug}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Created {new Date(organization.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant={organization.subscription_status === "active" ? "success" : "secondary"}>
          {organization.subscription_status || "no subscription"}
        </Badge>
        {organization.subscription_plan && (
          <Badge variant="secondary">{organization.subscription_plan}</Badge>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/organizations/${organization.id}`} aria-label={`Open ${organization.name}`}>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${organization.name}`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
