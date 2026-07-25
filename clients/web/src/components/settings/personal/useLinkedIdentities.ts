"use client";

import { useEffect, useState } from "react";
import { userApi, type Identity } from "@/lib/api";
import { hasFederatedIdentity } from "@/lib/federated-identity";

export function useLinkedIdentities(): {
  identities: Identity[];
  loading: boolean;
  federated: boolean;
} {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void userApi.listIdentities()
      .then((resp) => {
        if (!cancelled) setIdentities(resp.items);
      })
      .catch(() => {
        if (!cancelled) setIdentities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    identities,
    loading,
    federated: hasFederatedIdentity(identities),
  };
}
