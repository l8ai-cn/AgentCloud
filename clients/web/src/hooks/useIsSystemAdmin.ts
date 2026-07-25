"use client";

import { useEffect, useState } from "react";
import { userApi } from "@/lib/api";
import { getAuthManager } from "@/lib/wasm-core";
import { useAuthStore } from "@/stores/auth";

let cached: { token: string; value: Promise<boolean> } | null = null;

export function resolveIsSystemAdmin(): Promise<boolean> {
  const token = getAuthManager().get_token();
  if (!token) {
    cached = null;
    return Promise.resolve(false);
  }
  if (cached?.token !== token) {
    const value = userApi
      .getMe()
      .then(({ user }) => user.is_system_admin)
      .catch(() => {
        if (cached?.token === token) cached = null;
        return false;
      });
    cached = { token, value };
  }
  return cached.value;
}

export function useIsSystemAdmin(): boolean {
  const authTick = useAuthStore((state) => state._tick);
  const [state, setState] = useState({ authTick: -1, isAdmin: false });

  useEffect(() => {
    let active = true;
    resolveIsSystemAdmin().then((v) => {
      if (active) setState({ authTick, isAdmin: v });
    });
    return () => {
      active = false;
    };
  }, [authTick]);

  return state.authTick === authTick && state.isAdmin;
}
