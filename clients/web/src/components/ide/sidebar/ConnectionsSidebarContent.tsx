"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCurrentOrg } from "@/stores/auth";
import { useTranslations } from "next-intl";
import { Package, Plug, Sparkles, type LucideIcon } from "lucide-react";

interface ConnectionsSidebarContentProps {
  className?: string;
}

export function ConnectionsSidebarContent({ className }: ConnectionsSidebarContentProps) {
  const router = useRouter();
  const currentOrg = useCurrentOrg();
  const t = useTranslations();
  const orgSlug = currentOrg?.slug ?? "";

  const goBrowse = () => {
    if (orgSlug) router.push(`/${orgSlug}/connections`);
  };

  const goMine = () => {
    if (orgSlug) router.push(`/${orgSlug}/connections?view=mine`);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("ide.activities.connections")}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t("ide.sidebar.connections.description")}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <SidebarLink icon={Plug} label={t("ide.sidebar.connections.browse")} onClick={goBrowse} />
        <SidebarLink icon={Package} label={t("ide.sidebar.connections.mine")} onClick={goMine} />
      </div>
      <div className="bg-surface-muted/30 px-3 py-3 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
        {t("ide.sidebar.connections.hint")}
      </div>
    </div>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default ConnectionsSidebarContent;
