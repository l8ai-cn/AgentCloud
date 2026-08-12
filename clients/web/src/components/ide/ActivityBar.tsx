"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { useIDEStore, ACTIVITIES } from "@/stores/ide";
import { activityRoute, resolveActivityFromPathname } from "@/lib/ide-route";
import { useCurrentOrg } from "@/stores/auth";
import { useTotalUnreadCount } from "@/stores/channelMessageStore";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { OrgSwitcher } from "@/components/ide/OrgSwitcher";
import { ReminderArea } from "@/components/ide/ReminderArea";
import { ActivityBarLink } from "./ActivityBarLink";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";

interface ActivityBarProps {
  className?: string;
}

export function ActivityBar({ className }: ActivityBarProps) {
  const activeActivity = useIDEStore((s) => s.activeActivity);
  const setActiveActivity = useIDEStore((s) => s.setActiveActivity);
  const currentOrg = useCurrentOrg();
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = currentOrg?.slug || (params.org as string) || "";
  const t = useTranslations();
  const totalChannelUnread = useTotalUnreadCount();
  const isSystemAdmin = useIsSystemAdmin();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  React.useEffect(() => {
    const activity = resolveActivityFromPathname(pathname);
    if (activity) setActiveActivity(activity);
  }, [pathname, setActiveActivity]);

  const mainActivities = ACTIVITIES.filter((a) => a.id !== "settings");
  const bottomActivities = ACTIVITIES.filter((a) => a.id === "settings");

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "w-[120px] bg-surface flex flex-col",
          className
        )}
      >
        <div className="flex h-14 items-center justify-start px-2.5">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 flex flex-col items-stretch py-2 gap-1 px-2">
          {mainActivities.map((activity, idx) => {
            const isActive = !isAdminRoute && activeActivity === activity.id;
            const showBadge = activity.id === "channels" && totalChannelUnread > 0;
            const prev = mainActivities[idx - 1];
            const showDivider = prev && prev.group !== activity.group;

            return (
              <React.Fragment key={activity.id}>
                {showDivider && (
                  <div className="my-1 h-2" aria-hidden="true" />
                )}
                <ActivityBarLink
                  id={activity.id}
                  icon={activity.icon}
                  href={activityRoute(orgSlug, activity.id)}
                  label={t(`ide.activities.${activity.id}`)}
                  isActive={isActive}
                  showBadge={showBadge}
                  badgeCount={totalChannelUnread}
                  onClick={setActiveActivity}
                />
              </React.Fragment>
            );
          })}
        </nav>

        <ReminderArea />

        <nav className="flex flex-col items-stretch py-2 gap-1 px-2 pt-3">
          {isSystemAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin"
                  className={cn(
                    "motion-interactive pressable relative flex h-9 w-full items-center gap-2 rounded-lg px-2.5",
                    isAdminRoute
                      ? "bg-surface-raised text-foreground shadow-[var(--shadow-soft)] ring-1 ring-border/45 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="text-xs leading-tight font-medium truncate">
                    Admin
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent
                  side="right"
                  className="z-50 bg-popover text-popover-foreground px-2 py-1 text-sm rounded-md shadow-[var(--shadow-soft)]"
                >
                  Admin
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}

          {bottomActivities.map((activity) => {
            const isActive = !isAdminRoute && activeActivity === activity.id;

            return (
              <ActivityBarLink
                key={activity.id}
                id={activity.id}
                icon={activity.icon}
                href={activityRoute(orgSlug, activity.id)}
                label={t(`ide.activities.${activity.id}`)}
                isActive={isActive}
                onClick={setActiveActivity}
              />
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

export default ActivityBar;
