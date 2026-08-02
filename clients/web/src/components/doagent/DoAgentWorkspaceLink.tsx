"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Terminal } from "lucide-react";

export function DoAgentWorkspaceLink({ podKey }: { podKey: string }) {
  const t = useTranslations("doagent");
  const params = useParams();
  const org = typeof params.org === "string" ? params.org : "";
  if (!org) return null;
  return (
    <Link
      className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      href={`/${org}/workspace?pod=${encodeURIComponent(podKey)}`}
      title={t("openWorkspace")}
    >
      <Terminal className="h-3 w-3" />
      <span className="hidden sm:inline">{t("openWorkspace")}</span>
    </Link>
  );
}
