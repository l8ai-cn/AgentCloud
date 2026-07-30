import { Badge } from "@/components/ui/badge";
import type { AdminUser } from "@/lib/api/admin/types";
import { UserActionMenu } from "./UserActionMenu";
import type { UserAction } from "./useAdminUsers";

export function UserRow({
  user,
  currentUserId,
  onAction,
}: {
  user: AdminUser;
  currentUserId?: number;
  onAction: (user: AdminUser, action: UserAction) => void;
}) {
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{user.name || user.username}</p>
          {user.is_system_admin && <Badge>System admin</Badge>}
          {!user.is_active && <Badge variant="destructive">Disabled</Badge>}
          {!user.is_email_verified && <Badge variant="warning">Email unverified</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
        <p>
          {user.last_login_at
            ? `Last login ${new Date(user.last_login_at).toLocaleString()}`
            : "Never signed in"}
        </p>
      </div>
      <UserActionMenu
        user={user}
        currentUserId={currentUserId}
        onSelect={(action) => onAction(user, action)}
      />
    </div>
  );
}
