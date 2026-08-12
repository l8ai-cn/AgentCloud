import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { LightOrganization } from "@/lib/light-auth";

export function AcquireShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-9">
        {children}
      </div>
    </main>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const t = useTranslations("marketplace");
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label ?? t("acquire.loadingAcquire")}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-bg p-5 text-sm text-foreground">
      {message}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function SuccessState({
  organization,
  expertSlug,
}: {
  organization: LightOrganization;
  expertSlug?: string;
}) {
  const t = useTranslations("marketplace");
  const href = expertSlug
    ? `/${organization.slug}/experts/${expertSlug}`
    : `/${organization.slug}/experts`;
  return (
    <section className="py-4 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
      <h2 className="mt-4 text-2xl font-semibold text-foreground">{t("acquire.enabledTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("acquire.enabledBody", { name: organization.name })}
      </p>
      <Button asChild className="mt-6">
        <Link href={href}>{t("acquire.startFirstTask")}</Link>
      </Button>
    </section>
  );
}
