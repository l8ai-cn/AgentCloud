"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { userApi } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/lib/api/errors";

const MIN_PASSWORD_LEN = 8;

export function PersonalPasswordForm() {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LEN;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LEN &&
    newPassword === confirmPassword &&
    !saving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("settings.personal.general.passwordSaveSuccess"));
    } catch (error) {
      toast.error(
        getLocalizedErrorMessage(
          error,
          t as (key: string, values?: Record<string, string>) => string,
          t("settings.personal.general.passwordSaveFailed"),
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t("settings.personal.general.passwordTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.personal.general.passwordDescription")}
        </p>
      </div>

      <FormField
        label={t("settings.personal.general.currentPassword")}
        htmlFor="current-password"
        required
      >
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </FormField>

      <FormField
        label={t("settings.personal.general.newPassword")}
        htmlFor="new-password"
        required
        error={
          tooShort
            ? t("settings.personal.general.passwordTooShort", {
                min: MIN_PASSWORD_LEN,
              })
            : undefined
        }
        hint={t("settings.personal.general.newPasswordHint", {
          min: MIN_PASSWORD_LEN,
        })}
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </FormField>

      <FormField
        label={t("settings.personal.general.confirmPassword")}
        htmlFor="confirm-password"
        required
        error={
          mismatch
            ? t("settings.personal.general.passwordMismatch")
            : undefined
        }
      >
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={!canSubmit}>
          {saving
            ? t("settings.personal.general.saving")
            : t("settings.personal.general.changePassword")}
        </Button>
      </div>
    </div>
  );
}
