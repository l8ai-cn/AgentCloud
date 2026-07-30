"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertMessage } from "@/components/ui/alert-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { deleteOrganization } from "@/lib/api/admin/organizations";
import { getErrorMessage } from "@/lib/utils";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrganizationRunners } from "./OrganizationRunners";
import { SubscriptionPanel } from "./SubscriptionPanel";
import { useOrganizationDetail } from "./useOrganizationDetail";

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orgId = Number(id);
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { organization, members, error, loading } = useOrganizationDetail(orgId);

  if (!Number.isSafeInteger(orgId) || orgId <= 0) {
    return <AlertMessage type="error" message="Invalid organization identifier." />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-md bg-surface-muted" />
        <div className="h-56 animate-pulse rounded-md bg-surface-muted" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="space-y-4">
        <AlertMessage type="error" message={error ?? "Organization not found."} />
        <Button asChild variant="outline">
          <Link href="/admin/organizations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to organizations
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        breadcrumb={
          <Link
            href="/admin/organizations"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Organizations
          </Link>
        }
        title={organization.name}
        subtitle={organization.slug}
        actions={
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border-l-2 border-primary/50 pl-4">
          <p className="text-xs text-muted-foreground">Members</p>
          <p className="text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted-foreground">Subscription</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant={organization.subscription_status === "active" ? "success" : "secondary"}>
              {organization.subscription_status || "none"}
            </Badge>
            {organization.subscription_plan && (
              <Badge variant="outline">{organization.subscription_plan}</Badge>
            )}
          </div>
        </div>
        <div className="border-l-2 border-border pl-4">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">
            {new Date(organization.created_at).toLocaleDateString()}
          </p>
        </div>
      </section>

      <SubscriptionPanel orgId={orgId} />
      <OrganizationRunners orgId={orgId} />
      <OrganizationMembers members={members} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this organization?"
        description={`${organization.name} and its tenant-owned resources will be permanently deleted.`}
        variant="destructive"
        confirmText="Delete organization"
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteOrganization(orgId);
            toast.success("Organization deleted.");
            router.push("/admin/organizations");
          } catch (deleteError) {
            toast.error(getErrorMessage(deleteError, "Failed to delete organization."));
            throw deleteError;
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
