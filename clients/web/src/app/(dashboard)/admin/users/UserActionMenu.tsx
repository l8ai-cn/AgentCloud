"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser } from "@/lib/api/admin/types";
import type { UserAction } from "./useAdminUsers";

interface Props {
  user: AdminUser;
  currentUserId?: number;
  onSelect: (action: UserAction) => void;
}

export function UserActionMenu({ user, currentUserId, onSelect }: Props) {
  const isCurrentUser = user.id === currentUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.email}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={isCurrentUser && user.is_active}
          onSelect={() => onSelect(user.is_active ? "disable" : "enable")}
        >
          {user.is_active ? "Disable account" : "Enable account"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isCurrentUser && user.is_system_admin}
          onSelect={() =>
            onSelect(user.is_system_admin ? "revoke-admin" : "grant-admin")
          }
        >
          {user.is_system_admin ? "Revoke admin access" : "Grant admin access"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            onSelect(user.is_email_verified ? "unverify-email" : "verify-email")
          }
        >
          {user.is_email_verified ? "Remove email verification" : "Verify email"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
