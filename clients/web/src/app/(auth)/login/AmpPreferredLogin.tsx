"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/AuthShell";
import { buildSsoAuthUrl } from "@/lib/preferred-sso";

interface AmpPreferredLoginProps {
  domain: string;
  providerName?: string;
}

export function AmpPreferredLogin({
  domain,
  providerName = "AMP",
}: AmpPreferredLoginProps) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [redirecting, setRedirecting] = useState(true);

  const redirectParam = searchParams.get("redirect");
  const authUrl = buildSsoAuthUrl(domain, "oidc", redirectParam);
  const localHref = redirectParam
    ? `/login?local=1&redirect=${encodeURIComponent(redirectParam)}`
    : "/login?local=1";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign(authUrl);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [authUrl]);

  return (
    <AuthShell
      title={t("auth.sso.preferredTitle", { name: providerName })}
      subtitle={t("auth.sso.preferredSubtitle", { name: providerName })}
      footer={
        <Link href={localHref} className="auth-link" onClick={() => setRedirecting(false)}>
          {t("auth.sso.useLocalAccount")}
        </Link>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {redirecting
            ? t("auth.sso.redirectingToProvider", { name: providerName })
            : t("auth.sso.preferredManualHint", { name: providerName })}
        </p>
        <Button
          type="button"
          className="w-full"
          onClick={() => window.location.assign(authUrl)}
        >
          {t("auth.sso.signInWith", { name: providerName })}
        </Button>
        <div className="text-center">
          <Link href={localHref} className="auth-link text-sm">
            {t("auth.sso.useLocalAccount")}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
