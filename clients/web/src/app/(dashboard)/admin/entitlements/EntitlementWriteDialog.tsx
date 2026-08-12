"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { AdminEntitlementWriteInput } from "@/lib/api/admin/entitlements";
import type { AdminOrganization } from "@/lib/api/admin/organizations";

export interface EntitlementWriteTarget {
  resourceKind: string;
  resourceKey: string;
  organizationId: number;
  effect: "allow" | "deny";
}

interface EntitlementWriteDialogProps {
  target: EntitlementWriteTarget | null;
  organizations: AdminOrganization[];
  onClose: () => void;
  onSubmit: (input: AdminEntitlementWriteInput, effect: "allow" | "deny") => Promise<void>;
}

export function EntitlementWriteDialog({
  target,
  organizations,
  onClose,
  onSubmit,
}: EntitlementWriteDialogProps) {
  const t = useTranslations("admin.entitlements");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [subjectUserId, setSubjectUserId] = useState("");
  const [organizationId, setOrganizationId] = useState(0);
  const [saving, setSaving] = useState(false);

  const targetOrgId = target?.organizationId || organizationId;

  const close = () => {
    setReason("");
    setExpiresAt("");
    setSubjectUserId("");
    setOrganizationId(0);
    onClose();
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          resourceKind: target.resourceKind,
          resourceKey: target.resourceKey,
          organizationId: targetOrgId,
          subjectUserId: subjectUserId ? Number(subjectUserId) : undefined,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        },
        target.effect,
      );
      close();
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.effect === "deny" ? t("dialog.denyTitle") : t("dialog.grantTitle")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {target?.effect === "deny"
              ? t("dialog.denyDescription")
              : t("dialog.grantDescription")}
          </p>
          {target?.organizationId === 0 && (
            <FormField label={t("dialog.organization")} required>
              <Select
                value={organizationId ? String(organizationId) : ""}
                onValueChange={(value) => setOrganizationId(Number(value))}
              >
                <SelectTrigger>
                  <span className={organizationId ? undefined : "text-muted-foreground"}>
                    {organizations.find((org) => org.id === organizationId)?.name ??
                      t("filters.orgPlaceholder")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name} ({org.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <FormField label={t("dialog.reason")} htmlFor="entitlement-reason" required>
            <Input
              id="entitlement-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("dialog.reasonPlaceholder")}
            />
          </FormField>
          <FormField
            label={t("dialog.subjectUser")}
            htmlFor="entitlement-subject"
            hint={t("dialog.subjectUserHint")}
          >
            <Input
              id="entitlement-subject"
              inputMode="numeric"
              value={subjectUserId}
              onChange={(event) => setSubjectUserId(event.target.value.replace(/\D/g, ""))}
              placeholder={t("dialog.subjectUserPlaceholder")}
            />
          </FormField>
          <FormField
            label={t("dialog.expiresAt")}
            htmlFor="entitlement-expiry"
            hint={t("dialog.expiresAtHint")}
          >
            <Input
              id="entitlement-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant={target?.effect === "deny" ? "destructive" : "default"}
            disabled={!reason.trim() || !targetOrgId}
            loading={saving}
            onClick={submit}
          >
            {target?.effect === "deny" ? t("actions.deny") : t("actions.grant")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
