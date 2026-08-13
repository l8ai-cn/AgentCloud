"use client";

import { Globe2, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";

interface ShareAccessModeNoticeProps {
  grantCount: number;
}

/** Zero grants does not mean "nobody has it" — the backend treats an empty
 *  grant set as org-wide access, and the first grant flips the resource to an
 *  allow-list. Saying "not shared yet" here is what makes admins add a grant
 *  believing it only widens access, when it actually locks everyone else out. */
export function ShareAccessModeNotice({ grantCount }: ShareAccessModeNoticeProps) {
  const t = useTranslations("share");
  const unrestricted = grantCount === 0;
  const Icon = unrestricted ? Globe2 : ListChecks;

  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
        unrestricted
          ? "border-info/30 bg-info-bg text-info"
          : "border-warning/30 bg-warning-bg text-warning"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-medium">
          {unrestricted ? t("modeEveryone") : t("modeAllowList", { count: grantCount })}
        </p>
        <p className="opacity-90">
          {unrestricted ? t("modeEveryoneHint") : t("modeAllowListHint")}
        </p>
      </div>
    </div>
  );
}
