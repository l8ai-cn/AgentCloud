import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AdminOrganizationMember } from "@/lib/api/admin/organizations";
import { Users } from "lucide-react";

export function OrganizationMembers({
  members,
}: {
  members: AdminOrganizationMember[];
}) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Members ({members.length})</h2>
      </div>
      {members.length === 0 ? (
        <EmptyState
          size="compact"
          title="No members"
          description="This organization has no active membership records."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface-raised">
          {members.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {member.user?.name || member.user?.username || `User #${member.user_id}`}
                  </p>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{member.user?.email}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
