"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  Tags,
  Ticket,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/runners", label: "Runners", icon: Server },
  { href: "/admin/relays", label: "Relays", icon: Radio },
  { href: "/admin/sso", label: "SSO", icon: KeyRound },
  { href: "/admin/promo-codes", label: "Promo codes", icon: Tags },
  { href: "/admin/support-tickets", label: "Support", icon: Ticket },
  { href: "/admin/expert-market", label: "Expert review", icon: ShieldCheck },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="System administration"
      className="overflow-x-auto border-b border-border bg-surface-raised px-4 md:px-6"
    >
      <div className="flex min-w-max gap-1">
        {items.map(({ href, label, icon: Icon, exact }) => {
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
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
