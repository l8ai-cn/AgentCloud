"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listMembers, type OrganizationMember } from "@/lib/api/facade/org";

export function useOrgMemberDirectory(orgSlug: string | undefined) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  useEffect(() => {
    if (!orgSlug) return;
    let active = true;
    listMembers(orgSlug, { limit: 200 })
      .then((result) => {
        if (active) setMembers(result.items);
      })
      .catch(() => {
        if (active) setMembers([]);
      });
    return () => {
      active = false;
    };
  }, [orgSlug]);

  const byUserId = useMemo(
    () => new Map(members.map((member) => [Number(member.userId), member])),
    [members],
  );

  const label = useCallback(
    (userId: number) => {
      const user = byUserId.get(userId)?.user;
      return user ? user.name || user.username || user.email : `#${userId}`;
    },
    [byUserId],
  );

  return { members, label };
}
