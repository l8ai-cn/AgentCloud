"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ensureModelBinding } from "./ensure-model-binding";
import { resourceIdFromModelBindingName } from "./model-binding-resource-name";
import type { ResourceReference } from "./resource-editor-types";
import { useCompatibleModelResources } from "./use-compatible-model-resources";

interface WorkerTemplateModelBindingFieldProps {
  orgSlug: string;
  value?: ResourceReference;
  required: boolean;
  protocolAdapters: string[];
  onChange: (value: ResourceReference | undefined) => void;
  onCatalogInvalidate: () => void;
}

export function WorkerTemplateModelBindingField({
  orgSlug,
  value,
  required,
  protocolAdapters,
  onChange,
  onCatalogInvalidate,
}: WorkerTemplateModelBindingFieldProps) {
  const t = useTranslations("resourceEditor");
  const models = useCompatibleModelResources(orgSlug, {
    required,
    protocolAdapters,
  });
  const [ensuring, setEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const selectedResourceId = resourceIdFromModelBindingName(value?.name);
  const selected = models.options.find(
    (option) => option.resourceId === selectedResourceId,
  );
  const hint = models.loading || ensuring
    ? t("references.loading")
    : models.error
      ? models.error
      : models.options.length === 0
        ? t("references.noModelResources")
        : t("references.available", { count: models.options.length });

  return (
    <FormField
      label={t("fields.modelRef")}
      htmlFor="model-reference"
      required={required}
      hint={hint}
      error={ensureError ?? models.error ?? undefined}
    >
      <Select
        value={selectedResourceId ? String(selectedResourceId) : ""}
        disabled={models.loading || ensuring || models.options.length === 0}
        onValueChange={(next) => {
          const resourceId = Number(next);
          const option = models.options.find(
            (item) => item.resourceId === resourceId,
          );
          if (!option?.selectable) return;
          setEnsuring(true);
          setEnsureError(null);
          void ensureModelBinding(orgSlug, resourceId, option.label)
            .then((reference) => {
              onChange(reference);
              onCatalogInvalidate();
            })
            .catch((error: unknown) => {
              setEnsureError(
                error instanceof Error
                  ? error.message
                  : t("references.ensureModelBindingFailed"),
              );
            })
            .finally(() => setEnsuring(false));
        }}
      >
        <SelectTrigger
          id="model-reference"
          role="combobox"
          aria-label={t("fields.modelRef")}
          aria-required={required}
        >
          <span className={selected || value?.name
            ? "truncate"
            : "truncate text-muted-foreground"}
          >
            {selected?.label || value?.name || t("fields.modelRef")}
          </span>
        </SelectTrigger>
        <SelectContent>
          {models.options.map((option) => (
            <SelectItem
              key={option.resourceId}
              value={String(option.resourceId)}
              disabled={!option.selectable}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{option.label}</span>
                {!option.selectable && option.blockingReason ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {option.blockingReason}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {models.options.length === 0 && !models.loading ? (
        <Link
          href={`/${orgSlug}/settings?tab=ai-resources`}
          className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
        >
          {t("references.manageModelResources")}
        </Link>
      ) : null}
    </FormField>
  );
}
