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

  // Wait for session hydration before mounting AmpPreferredLogin — its 50ms
  // AMP assign otherwise races (and wins) against useRedirectIfAuthenticated,
  // bouncing already-logged-in users back to the IdP instead of app home.
  // Only skip auto-redirect on the local password form (popout ?redirect= race);
  // preferred AMP path must still bounce authenticated sessions to home.
  const { hydrated, redirecting } = useRedirectIfAuthenticated({
    skipIfRedirectParam: usePreferredAmp ? null : searchParams.get("redirect"),
  });

  if (!hydrated || redirecting) {
    return null;
  }

  if (usePreferredAmp) {
    return <AmpPreferredLogin domain={preferredSsoDomain!} providerName="AMP" />;
  }

  return <LocalLoginForm />;
}
