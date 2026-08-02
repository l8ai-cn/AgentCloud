"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PodData } from "@/lib/api";
import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import type { WorkerCreateController } from "../hooks/workerCreateController";
import { launchWorkerFromNaturalLanguage } from "./worker-create-ai-launch";
import { aiLaunchErrorMessage } from "./worker-quick-create-errors";

interface WorkerQuickCreateProps {
  controller: WorkerCreateController;
  t: (key: string) => string;
  ticketSlug?: string;
  onSuccess?: (pod: PodData) => void;
}

export function WorkerQuickCreate({
  controller,
  t,
  ticketSlug,
  onSuccess,
}: WorkerQuickCreateProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { state } = controller;
  const prompt = state.fillPrompt;
  const busy =
    creating ||
    state.fill.status === "loading" ||
    state.create.status === "loading";

  async function createWithAI() {
    const text = prompt.trim();
    if (!text) {
      setLocalError(t("workers.create.quick.taskRequired"));
      return;
    }
    if (
      controller.options.status !== "ready" ||
      controller.modelResources.status !== "ready" ||
      controller.configBundles.status !== "ready"
    ) {
      setLocalError(t("workers.create.quick.defaultsNotReady"));
      return;
    }
    setLocalError(null);
    setCreating(true);
    try {
      const result = await launchWorkerFromNaturalLanguage({
        prompt: text,
        draft: state.draft,
        options: controller.options.data,
        models: controller.modelResources.data,
        configBundles: controller.configBundles.data,
        ticketSlug,
      });
      controller.patchDraft(result.draft);
      controller.setFillPrompt(text);
      onSuccess?.(result.pod);
    } catch (error) {
      setLocalError(aiLaunchErrorMessage(error, t));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-border bg-surface-raised p-4 md:p-5"
      data-testid="worker-quick-create"
    >
      <div className="mb-4 flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <h2 className="text-base font-semibold">{t("workers.create.quick.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workers.create.quick.subtitle")}
          </p>
        </div>
      </div>

      <label htmlFor="worker-quick-ai-prompt" className="mb-2 block text-sm font-medium">
        {t("workers.create.quick.taskLabel")}
      </label>
      <Textarea
        id="worker-quick-ai-prompt"
        value={prompt}
        rows={4}
        maxLength={10000}
        placeholder={t("workers.create.quick.taskPlaceholder")}
        disabled={busy}
        onChange={(event) => {
          setLocalError(null);
          controller.setFillPrompt(event.target.value);
          controller.patchDraft({ initial_task: event.target.value });
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!busy && prompt.trim()) void createWithAI();
          }
        }}
      />

      <DefaultSummary controller={controller} t={t} />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("workers.create.quick.defaultsHint")}
        </p>
        <Button
          type="button"
          className="h-11 sm:h-9"
          disabled={busy || !prompt.trim()}
          onClick={() => void createWithAI()}
          data-testid="worker-ai-create"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {busy ? t("workers.create.quick.creating") : t("workers.create.quick.create")}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {localError && <AlertMessage type="error" message={localError} />}
        {state.create.status === "error" && (
          <AlertMessage type="error" message={state.create.error} />
        )}
      </div>
    </section>
  );
}

function DefaultSummary({
  controller,
  t,
}: {
  controller: WorkerCreateController;
  t: (key: string) => string;
}) {
  const { state, options, modelResources } = controller;
  if (options.status !== "ready") {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {t("workers.create.quick.loadingDefaults")}
      </p>
    );
  }
  const draft = state.draft;
  const selected = [
    optionName(options.data.worker_types, draft.worker_type_slug, (item) => item.slug),
    modelResources.status === "ready"
      ? modelResourceName(modelResources.data, draft.model_resource_id)
      : null,
    optionName(options.data.runtime_images, draft.runtime_image_id, (item) => item.id),
  ].filter(Boolean);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {selected.map((label) => (
        <span
          key={label}
          className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs text-muted-foreground"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function modelResourceName(resources: EffectiveResource[], id: number): string | null {
  const found = resources.find((item) => item.resource?.id === id);
  return found?.resource?.displayName || found?.resource?.modelId || null;
}

function optionName<T, V>(
  options: T[],
  value: V,
  pick: (item: T) => V,
  name: (item: T) => string = (item) => String((item as { name?: string }).name ?? value),
): string | null {
  const found = options.find((item) => pick(item) === value);
  return found ? name(found) : null;
}
