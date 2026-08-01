"use client";

import type React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <Card variant="default" className="surface-card">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 break-all font-mono text-xs text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs leading-5 text-foreground ring-1 ring-border/60">
      <code>{code}</code>
    </pre>
  );
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground motion-interactive hover:border-primary/30 hover:bg-surface-muted"
    >
      <span>{children}</span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}
