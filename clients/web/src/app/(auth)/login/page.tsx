"use client";

import { useSearchParams } from "next/navigation";
import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { getPreferredSsoDomain, isLocalLoginRequested } from "@/lib/preferred-sso";
import { AmpPreferredLogin } from "./AmpPreferredLogin";
import { LocalLoginForm } from "./LocalLoginForm";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const preferredSsoDomain = getPreferredSsoDomain();
  const localLogin = isLocalLoginRequested(searchParams);
  const usePreferredAmp = !!(preferredSsoDomain && !localLogin);

  // Preferred AMP path must wait for hydration and skip mounting while an
  // authenticated redirect is in flight — otherwise AmpPreferredLogin's 50ms
  // IdP assign races (and wins) against useRedirectIfAuthenticated.
  // Local password form keeps rendering during redirect so e2e (suite-wide
  // storageState) and popout ?redirect= races are unchanged.
  const { hydrated, redirecting } = useRedirectIfAuthenticated({
    skipIfRedirectParam: usePreferredAmp ? null : searchParams.get("redirect"),
  });

  if (usePreferredAmp) {
    if (!hydrated || redirecting) return null;
    return <AmpPreferredLogin domain={preferredSsoDomain!} providerName="AMP" />;
  }

  return <LocalLoginForm />;
}
