"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { userApi } from "@/lib/api";
import { getLocalizedErrorMessage } from "@/lib/api/errors";
import { useAuthStore, useCurrentUser } from "@/stores/auth";

export function PersonalProfileForm({ federated = false }: { federated?: boolean }) {
  const t = useTranslations();
  const user = useCurrentUser();
  const syncCurrentUser = useAuthStore((s) => s.syncCurrentUser);
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatar_url ?? "");
  }, [user?.name, user?.avatar_url]);

  const dirty =
    (name.trim() || "") !== (user?.name ?? "") ||
    (avatarUrl.trim() || "") !== (user?.avatar_url ?? "");

  const handleSave = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    try {
      const { user: updated } = await userApi.updateMe({
        name: name.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      });
      syncCurrentUser({
        id: updated.id,
        email: updated.email,
        username: updated.username,
        name: updated.name,
        avatar_url: updated.avatar_url,
      });
      toast.success(t("settings.personal.general.profileSaveSuccess"));
    } catch (error) {
      toast.error(
        getLocalizedErrorMessage(
          error,
          t as (key: string, values?: Record<string, string>) => string,
          t("settings.personal.general.profileSaveFailed"),
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const preview = avatarUrl.trim();

  return (
    <div className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t("settings.personal.general.profileTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {federated
            ? t("settings.personal.general.profileFederatedDescription")
            : t("settings.personal.general.profileDescription")}
        </p>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-lg font-semibold text-muted-foreground">
              {(user?.name || user?.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <FormField
            label={t("settings.personal.general.displayName")}
            htmlFor="profile-name"
            hint={t("settings.personal.general.displayNameHint")}
          >
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.personal.general.displayNamePlaceholder")}
              maxLength={100}
            />
          </FormField>
          <FormField
            label={t("settings.personal.general.avatarUrl")}
            htmlFor="profile-avatar"
            hint={t("settings.personal.general.avatarUrlHint")}
          >
            <Input
              id="profile-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://"
            />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={!dirty || saving}>
          {saving
            ? t("settings.personal.general.saving")
            : t("settings.personal.general.saveProfile")}
        </Button>
      </div>
    </div>
  );
}
