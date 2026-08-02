"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useCompatibleModelResources } from "./use-compatible-model-resources";

interface ModelBindingResourceFieldProps {
  orgSlug: string;
  value: number;
  onChange: (resourceId: number) => void;
}

export function ModelBindingResourceField({
  orgSlug,
  value,
  onChange,
}: ModelBindingResourceFieldProps) {
  const t = useTranslations("resourceEditor");
  const models = useCompatibleModelResources(orgSlug, {
    required: false,
    protocolAdapters: [],
  });
  const selected = models.options.find((option) => option.resourceId === value);
  const hint = models.loading
    ? t("references.loading")
    : models.error
      ? models.error
      : models.options.length === 0
        ? t("references.noModelResources")
        : t("references.available", { count: models.options.length });

  return (
    <FormField
      label={t("fields.modelResourceId")}
      htmlFor="binding-resource-id"
      required
      hint={hint}
      error={models.error ?? undefined}
    >
      <Select
        value={value > 0 ? String(value) : ""}
        disabled={models.loading || models.options.length === 0}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger
          id="binding-resource-id"
          role="combobox"
          aria-label={t("fields.modelResourceId")}
          aria-required
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected?.label || t("fields.modelResourceId")}
          </span>
        </SelectTrigger>
        <SelectContent>
          {models.options.map((option) => (
            <SelectItem
              key={option.resourceId}
              value={String(option.resourceId)}
              disabled={!option.selectable}
            >
              {option.label}
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
