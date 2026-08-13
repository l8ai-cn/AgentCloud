"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentUser, useCurrentOrg, useAuthStore } from "@/stores/auth";
import { organizationApi } from "@/lib/api";
import { listGrants, createGrant, deleteGrant } from "@/lib/api/facade/grantConnect";
import type { ResourceGrant, OrganizationMember } from "@/lib/api";
import { ShareAccessModeNotice } from "./ShareAccessModeNotice";
import { ShareGrantList } from "./ShareGrantList";

/** Mirrors backend/internal/domain/grant type constants — Layer 2 addresses
 *  organization-owned instances by their integer primary key. */
export type ShareableResourceType =
  | "pod"
  | "runner"
  | "repository"
  | "model_connection"
  | "skill"
  | "expert";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ShareableResourceType;
  resourceId: string;
  title?: string;
}

export function ShareDialog({ open, onOpenChange, resourceType, resourceId, title }: ShareDialogProps) {
  const t = useTranslations();
  const currentOrg = useCurrentOrg();
  const currentUser = useCurrentUser();

  const [grants, setGrants] = useState<ResourceGrant[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dialogProps, confirm } = useConfirmDialog();

  const loadData = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [grantsRes, membersRes] = await Promise.all([
        listGrants(currentOrg.slug, resourceType, resourceId),
        organizationApi.listMembers(currentOrg.slug),
      ]);
      setGrants(grantsRes.grants || []);
      setMembers(membersRes.members || []);
    } catch {
      setError(t("share.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [currentOrg, resourceType, resourceId, t]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const grantedUserIds = new Set(grants.map((g) => g.user_id));
  const availableMembers = members.filter(
    (m) => Number(m.userId) !== currentUser?.id && !grantedUserIds.has(Number(m.userId))
  );

  const handleShare = async () => {
    if (!selectedUserId || !currentOrg) return;
    setSharing(true);
    setError(null);
    try {
      await createGrant(currentOrg.slug, resourceType, resourceId, parseInt(selectedUserId));
      setSelectedUserId("");
      await loadData();
    } catch {
      setError(t("share.grantFailed"));
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (grantId: number) => {
    if (!currentOrg) return;
    const confirmed = await confirm({
      title: t("share.revokeConfirmTitle"),
      description:
        grants.length === 1
          ? t("share.revokeLastConfirmDescription")
          : t("share.revokeConfirmDescription"),
      variant: "destructive",
      confirmText: t("share.revoke"),
      cancelText: t("common.cancel"),
    });
    if (!confirmed) return;
    try {
      await deleteGrant(currentOrg.slug, resourceType, resourceId, grantId);
      await loadData();
    } catch {
      setError(t("share.revokeFailed"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title ?? t("share.title")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <ShareAccessModeNotice grantCount={grants.length} />
            <div className="space-y-3 pb-3 border-b border-border">
              <FormField label={t("share.selectUser")} htmlFor="share-user">
                <select
                  id="share-user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 bg-background text-sm"
                >
                  <option value="">{t("share.selectUserPlaceholder")}</option>
                  {availableMembers.map((m) => {
                    const userId = Number(m.userId);
                    return (
                    <option key={userId} value={userId}>
                      {m.user?.name || m.user?.username || m.user?.email}
                    </option>
                  );
                  })}
                </select>
              </FormField>
              <Button onClick={handleShare} disabled={sharing || !selectedUserId} className="w-full" size="sm">
                {sharing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                {t("share.share")}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("share.allowListHeading")}</p>
              <ShareGrantList grants={grants} loading={loading} onRevoke={handleRevoke} />
            </div>

            {error && (
              <div className="p-2 bg-destructive/10 text-destructive rounded text-sm">{error}</div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
