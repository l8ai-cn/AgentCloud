"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { readCurrentOrg, useAuthStore } from "@/stores/auth";
import { CenteredSpinner } from "@/components/ui/spinner";

// Sits inside the (dashboard) layout, so wasm + RequireAuth already guarantee
// an authenticated user. The store's cached user omits is_system_admin, so we
// resolve it authoritatively via GetMe. Server-side handlers re-check
// is_system_admin per RPC — this gate is purely UX (hide the route, redirect).
type Gate = "checking" | "allowed" | "denied";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authTick = useAuthStore((state) => state._tick);
  const [state, setState] = useState<{ authTick: number; gate: Gate }>({
    authTick: -1,
    gate: "checking",
  });

  useEffect(() => {
    let cancelled = false;
    resolveIsSystemAdmin().then((isAdmin) => {
      if (cancelled) return;
      if (isAdmin) {
        setState({ authTick, gate: "allowed" });
        return;
      }
      setState({ authTick, gate: "denied" });
      const slug = readCurrentOrg()?.slug;
      router.replace(slug ? `/${slug}` : "/");
    });
    return () => {
      cancelled = true;
    };
  }, [authTick, router]);

  const gate = state.authTick === authTick ? state.gate : "checking";
  if (gate === "allowed") return <>{children}</>;
  if (gate === "checking") return <CenteredSpinner />;
  return null;
}
