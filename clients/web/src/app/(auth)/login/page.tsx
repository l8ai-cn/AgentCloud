"use client";

import { useSearchParams } from "next/navigation";
import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { getPreferredSsoDomain, isLocalLoginRequested } from "@/lib/preferred-sso";
import { AmpPreferredLogin } from "./AmpPreferredLogin";
import { LocalLoginForm } from "./LocalLoginForm";

export default function LoginPage() {
  const searchParams = useSearchParams();
  useRedirectIfAuthenticated({
    skipIfRedirectParam: searchParams.get("redirect"),
  });

  const preferredSsoDomain = getPreferredSsoDomain();
  const localLogin = isLocalLoginRequested(searchParams);

  if (preferredSsoDomain && !localLogin) {
    return <AmpPreferredLogin domain={preferredSsoDomain} providerName="AMP" />;
  }

  return <LocalLoginForm />;
}
