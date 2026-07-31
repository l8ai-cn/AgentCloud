"use client";

import { useTranslations } from "next-intl";

import type { SSOAction } from "./useSSOConfigs";

export type SSOConfirmAction = Exclude<SSOAction, "test">;

export interface SSOConfirmCopy {
  title: string;
  description: string;
  confirmText: string;
  destructive: boolean;
}

export function useSsoConfirmCopy() {
  const t = useTranslations("admin");

  return (action: SSOConfirmAction, domain: string): SSOConfirmCopy => {
    if (action === "enable") {
      return {
        title: t("sso.confirm.enableTitle"),
        description: t("sso.confirm.enableDescription", { domain }),
        confirmText: t("common.enable"),
        destructive: false,
      };
    }
    if (action === "disable") {
      return {
        title: t("sso.confirm.disableTitle"),
        description: t("sso.confirm.disableDescription", { domain }),
        confirmText: t("common.disable"),
        destructive: true,
      };
    }
    return {
      title: t("sso.confirm.deleteTitle"),
      description: t("sso.confirm.deleteDescription", { domain }),
      confirmText: t("common.delete"),
      destructive: true,
    };
  };
}
