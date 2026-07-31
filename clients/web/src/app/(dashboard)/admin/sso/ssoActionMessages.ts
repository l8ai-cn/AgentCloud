"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

export interface SSOActionMessages {
  loadFailed: string;
  created: string;
  createFailed: string;
  updated: string;
  updateFailed: string;
  testPassed: string;
  testFailed: string;
  success: { enable: string; disable: string; delete: string };
  failure: { enable: string; disable: string; delete: string; test: string };
}

export function useSsoActionMessages(): SSOActionMessages {
  const t = useTranslations("admin");
  return useMemo(() => ({
    loadFailed: t("sso.toast.loadFailed"),
    created: t("sso.toast.created"),
    createFailed: t("sso.toast.createFailed"),
    updated: t("sso.toast.updated"),
    updateFailed: t("sso.toast.updateFailed"),
    testPassed: t("sso.toast.testPassed"),
    testFailed: t("sso.toast.testFailed"),
    success: {
      enable: t("sso.toast.enabled"),
      disable: t("sso.toast.disabled"),
      delete: t("sso.toast.deleted"),
    },
    failure: {
      enable: t("sso.toast.enableFailed"),
      disable: t("sso.toast.disableFailed"),
      delete: t("sso.toast.deleteFailed"),
      test: t("sso.toast.testActionFailed"),
    },
  }), [t]);
}
