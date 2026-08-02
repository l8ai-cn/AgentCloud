"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { CreatePodForm } from "@/components/pod/CreatePodForm";
import { ResourceDependencyEditor } from "@/components/resource-editor/ResourceDependencyEditor";
import { ResourceEditorShell } from "@/components/resource-editor/ResourceEditorShell";
import { PillTabs } from "@/components/ui/pill-tabs";

export function CreateWorkerPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgSlug = params.org as string;
  const requestedMode = searchParams.get("mode");

  const [mode, setMode] = useState<"run" | "template" | "resources">(
    () => pageMode(requestedMode),
  );

  useEffect(() => {
    setMode(pageMode(requestedMode));
  }, [requestedMode]);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <Link
          href={`/${orgSlug}/workspace`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workers.create.backToWorkspace")}
        </Link>

        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("workers.create.title")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("workers.create.subtitle")}
          </p>
        </header>

        <PillTabs
          active={mode}
          onChange={(value) => {
            const nextMode = pageMode(value);
            const nextSearchParams = new URLSearchParams(
              searchParams.toString(),
            );
            setMode(nextMode);
            if (nextMode === "run") {
              nextSearchParams.delete("mode");
            } else {
              nextSearchParams.set("mode", nextMode);
            }
            const query = nextSearchParams.toString();
            window.history.replaceState(
              window.history.state,
              "",
              query ? `${pathname}?${query}` : pathname,
            );
          }}
          tabs={[
            { id: "run", label: t("resourceEditor.mode.run") },
            { id: "template", label: t("resourceEditor.mode.template") },
            { id: "resources", label: t("resourceEditor.mode.resources") },
          ]}
          className="mb-6"
        />

        {mode === "run" ? (
          <CreatePodForm
            config={{
              scenario: "workspace",
              onSuccess: (pod) => {
                router.push(
                  `/${orgSlug}/workspace?pod=${encodeURIComponent(pod.pod_key)}`,
                );
              },
              onCancel: () => {
                router.push(`/${orgSlug}/workspace`);
              },
            }}
          />
        ) : mode === "template" ? (
          <ResourceEditorShell
            orgSlug={orgSlug}
            sessionKey={`worker-template:${orgSlug}`}
          />
        ) : (
          <ResourceDependencyEditor orgSlug={orgSlug} />
        )}
      </div>
    </div>
  );
}

function pageMode(mode: string | null): "run" | "template" | "resources" {
  return mode === "template" || mode === "resources" ? mode : "run";
}
