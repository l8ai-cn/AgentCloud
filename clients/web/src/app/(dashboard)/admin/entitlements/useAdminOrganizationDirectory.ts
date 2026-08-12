"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listOrganizations,
  type AdminOrganization,
} from "@/lib/api/admin/organizations";

const PAGE_SIZE = 50;

export function useAdminOrganizationDirectory(search: string) {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const timer = setTimeout(() => {
      listOrganizations({ search: search || undefined, page: 1, page_size: PAGE_SIZE })
        .then((page) => {
          if (active) setOrganizations(page.data);
        })
        .catch(() => {
          if (active) setOrganizations([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const byId = useMemo(
    () => new Map(organizations.map((org) => [org.id, org])),
    [organizations],
  );

  const label = useCallback(
    (id: number) => {
      const org = byId.get(id);
      return org ? `${org.name} (${org.slug})` : `#${id}`;
    },
    [byId],
  );

  return { organizations, loading, label };
}
