"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useIDEStore, getMoreMenuActivities, type ActivityType } from "@/stores/ide";
import { useCurrentOrg } from "@/stores/auth";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { useTranslations } from "next-intl";
import {
  Network,
  Server,
  Settings,
  Repeat,
  Target,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { MobileThemeMenu } from "./MobileThemeMenu";

const ICON_MAP: Record<string, LucideIcon> = {
  network: Network,
  server: Server,
  settings: Settings,
  repeat: Repeat,
  target: Target,
  sparkles: Sparkles,
};

interface MobileMoreMenuProps {
  className?: string;
}

export function MobileMoreMenu({ className }: MobileMoreMenuProps) {
  const router = useRouter();
  const { setActiveActivity, mobileMoreMenuOpen, setMobileMoreMenuOpen } =
    useIDEStore();
  const currentOrg = useCurrentOrg();
  const isSystemAdmin = useIsSystemAdmin();
  const t = useTranslations();
  const orgSlug = currentOrg?.slug || "";

  const moreActivities = getMoreMenuActivities();

  const getActivityRoute = (activity: ActivityType): string => {
    switch (activity) {
      case "mesh":
        return `/${orgSlug}/mesh`;
      case "loops":
        return `/${orgSlug}/loops`;
      case "workflows":
        return `/${orgSlug}/workflows`;
      case "automation":
        return `/${orgSlug}/automation`;
      case "runners":
        return `/${orgSlug}/runners`;
      case "settings":
        return `/${orgSlug}/settings`;
      default:
        return `/${orgSlug}/workspace`;
    }
  };

  const navigate = (route: string) => {
    setMobileMoreMenuOpen(false);
    router.push(route);
  };

  const handleActivityClick = (activity: ActivityType) => {
    setActiveActivity(activity);
    navigate(getActivityRoute(activity));
  };

  return (
    <Drawer.Root
      open={mobileMoreMenuOpen}
      onOpenChange={setMobileMoreMenuOpen}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl z-50",
            className
          )}
          aria-describedby={undefined}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>

          {/* Title - Required for accessibility */}
          <div className="px-4 pb-2">
            <Drawer.Title className="text-lg font-semibold">{t("mobile.more")}</Drawer.Title>
          </div>

          {/* Menu items */}
          <div className="px-2 pb-safe">
            {/* Activity items */}
            {moreActivities.map((activity) => {
              const Icon = ICON_MAP[activity.icon] || Settings;

              return (
                <button
                  key={activity.id}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted active:bg-muted transition-colors"
                  onClick={() => handleActivityClick(activity.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">{t(`ide.activities.${activity.id}`)}</span>
                </button>
              );
            })}

            {isSystemAdmin && (
              <button
                className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted active:bg-muted transition-colors"
                onClick={() => navigate("/admin")}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">{t("admin.title")}</span>
              </button>
            )}

            {/* Divider */}
            <div className="h-px bg-border my-2 mx-4" />

            <MobileThemeMenu />
          </div>

          {/* Safe area padding */}
          <div className="h-6" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default MobileMoreMenu;
