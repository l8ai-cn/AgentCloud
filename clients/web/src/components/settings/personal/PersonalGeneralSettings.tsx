"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSettings } from "@/components/settings/LanguageSettings";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { useAuthStore, useCurrentUser } from "@/stores/auth";
import { FederatedAccountNotice } from "./FederatedAccountNotice";
import { PersonalPasswordForm } from "./PersonalPasswordForm";
import { PersonalProfileForm } from "./PersonalProfileForm";
import { useLinkedIdentities } from "./useLinkedIdentities";

export function PersonalGeneralSettings() {
  const router = useRouter();
  const t = useTranslations();
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const { federated, loading } = useLinkedIdentities();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div className="surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {t("settings.personal.general.accountInfo")}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("settings.personal.general.username")}
              </p>
              <p className="font-medium">{user?.username || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("settings.personal.general.email")}
              </p>
              <p className="font-medium">{user?.email || "-"}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.personal.general.accountReadonlyHint")}
          </p>
        </div>
      </div>

      {!loading && federated && <FederatedAccountNotice />}
      <PersonalProfileForm federated={federated} />
      {!loading && !federated && <PersonalPasswordForm />}
      <LanguageSettings />
      <ThemeSettings />

      <div className="surface-card p-6">
        <h2 className="mb-2 text-lg font-semibold">
          {t("settings.personal.general.session")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("settings.personal.general.sessionDescription")}
        </p>
        <Button
          variant="outline"
          onClick={() => void handleLogout()}
          className="flex items-center gap-2 text-destructive hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {t("settings.personal.general.logout")}
        </Button>
      </div>
    </div>
  );
}
