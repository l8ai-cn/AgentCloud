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
import { EntitlementResourcePicker } from "@/components/entitlement/EntitlementResourcePicker";
import type {
  EntitlementKind,
  MemberEntitlementInput,
} from "@/lib/api/entitlement/entitlementTypes";
import type { OrganizationMember } from "@/lib/api/facade/org";

export interface MemberEntitlementTarget {
  resourceKind: EntitlementKind;
  /** Empty when the admin is restricting a resource that has no rows yet, so
   *  the dialog has to ask which one before it can write. */
  resourceKey: string;
  effect: "allow" | "deny";
}

interface MemberEntitlementDialogProps {
  orgSlug: string;
  target: MemberEntitlementTarget | null;
  members: OrganizationMember[];
  memberLabel: (userId: number) => string;
  onClose: () => void;
  onSubmit: (input: MemberEntitlementInput, effect: "allow" | "deny") => Promise<void>;
}

export function MemberEntitlementDialog({
  orgSlug,
  target,
  members,
  memberLabel,
  onClose,
  onSubmit,
}: MemberEntitlementDialogProps) {
  const t = useTranslations("settings.memberAccess");
  const [userId, setUserId] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<EntitlementKind>("worker_type");
  const [resourceKey, setResourceKey] = useState("");

  const picksResource = target?.resourceKey === "";
  const effectiveKind = picksResource ? kind : (target?.resourceKind ?? "worker_type");
  const effectiveKey = picksResource ? resourceKey : (target?.resourceKey ?? "");

  const close = () => {
    setUserId(0);
    setReason("");
    setResourceKey("");
    onClose();
  };

  const submit = async () => {
    if (!target || !userId || !effectiveKey) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          orgSlug,
          resourceKind: effectiveKind,
          resourceKey: effectiveKey,
          userId,
          reason,
        },
        target.effect,
      );
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.effect === "deny" ? t("dialog.denyTitle") : t("dialog.allowTitle")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {target?.effect === "deny"
              ? t("dialog.denyDescription")
              : t("dialog.allowDescription")}
          </p>
          {picksResource && (
            <FormField label={t("dialog.resource")} required>
              <EntitlementResourcePicker
                kind={kind}
                resourceKey={resourceKey}
                onKindChange={setKind}
                onResourceKeyChange={setResourceKey}
              />
            </FormField>
          )}
          <FormField label={t("dialog.member")} required>
            <Select
              value={userId ? String(userId) : ""}
              onValueChange={(value) => setUserId(Number(value))}
            >
              <SelectTrigger>
                <span className={userId ? undefined : "text-muted-foreground"}>
                  {userId ? memberLabel(userId) : t("dialog.memberPlaceholder")}
                </span>
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id.toString()} value={String(member.userId)}>
                    {memberLabel(Number(member.userId))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("dialog.reason")} htmlFor="member-entitlement-reason" required>
            <Input
              id="member-entitlement-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("dialog.reasonPlaceholder")}
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant={target?.effect === "deny" ? "destructive" : "default"}
            disabled={!userId || !reason.trim() || !effectiveKey}
            loading={saving}
            onClick={submit}
          >
            {target?.effect === "deny" ? t("actions.deny") : t("actions.allow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
