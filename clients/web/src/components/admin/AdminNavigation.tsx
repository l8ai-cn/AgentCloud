"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Ticket,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", labelKey: "nav.overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "nav.users", icon: Users },
  { href: "/admin/organizations", labelKey: "nav.organizations", icon: Building2 },
  { href: "/admin/entitlements", labelKey: "nav.entitlements", icon: SlidersHorizontal },
  { href: "/admin/runners", labelKey: "nav.runners", icon: Server },
  { href: "/admin/relays", labelKey: "nav.relays", icon: Radio },
  { href: "/admin/sso", labelKey: "nav.sso", icon: KeyRound },
  { href: "/admin/promo-codes", labelKey: "nav.promoCodes", icon: Tags },
  { href: "/admin/support-tickets", labelKey: "nav.support", icon: Ticket },
  { href: "/admin/expert-market", labelKey: "nav.expertReview", icon: ShieldCheck },
  { href: "/admin/audit-logs", labelKey: "nav.auditLogs", icon: ScrollText },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <nav
      aria-label={t("nav.label")}
      className="overflow-x-auto border-b border-border bg-surface-raised px-4 md:px-6"
    >
      <div className="flex min-w-max gap-1">
        {items.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
