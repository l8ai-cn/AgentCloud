"use client";

import { Input } from "@/components/ui/input";
import type { EnvVarSchemaEntry } from "@/lib/api";
import { useTranslations } from "next-intl";

interface ConnectionEnvVarFieldsProps {
  schema: EnvVarSchemaEntry[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
}

export function ConnectionEnvVarFields({
  schema,
  values,
  onChange,
  disabled,
}: ConnectionEnvVarFieldsProps) {
  const t = useTranslations();
  if (schema.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t("connections.envVars")}</h4>
      {schema.map((entry) => (
        <div key={entry.name}>
          <label htmlFor={`env-${entry.name}`} className="text-sm font-medium mb-1 block">
            {entry.label || entry.name}
            {entry.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <Input
            id={`env-${entry.name}`}
            type={entry.sensitive ? "password" : "text"}
            placeholder={entry.placeholder || entry.name}
            value={values[entry.name] || ""}
            onChange={(e) => onChange(entry.name, e.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export function hasUnfilledRequiredEnvVars(
  schema: EnvVarSchemaEntry[] | null | undefined,
  values: Record<string, string>,
): boolean {
  return schema?.some((entry) => entry.required && !values[entry.name]?.trim()) ?? false;
}

export function filledEnvVars(values: Record<string, string>): Record<string, string> | undefined {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value.trim()) filtered[key] = value.trim();
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
