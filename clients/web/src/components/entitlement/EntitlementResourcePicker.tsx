"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  ENTITLEMENT_KINDS,
  type EntitlementKind,
} from "@/lib/api/entitlement/entitlementTypes";
import { resourceOptionsFor } from "./entitlementResourceOptions";

interface EntitlementResourcePickerProps {
  kind: EntitlementKind;
  resourceKey: string;
  onKindChange: (value: EntitlementKind) => void;
  onResourceKeyChange: (value: string) => void;
}

export function EntitlementResourcePicker({
  kind,
  resourceKey,
  onKindChange,
  onResourceKeyChange,
}: EntitlementResourcePickerProps) {
  const t = useTranslations("entitlement");
  const options = resourceOptionsFor(kind);
  const selected = options.find((option) => option.value === resourceKey);

  return (
    <div className="grid gap-3 sm:grid-cols-[12rem_minmax(14rem,1fr)]">
      <Select
        value={kind}
        onValueChange={(value) => {
          onKindChange(value as EntitlementKind);
          onResourceKeyChange("");
        }}
      >
        <SelectTrigger aria-label={t("kindLabel")}>{t(`kind.${kind}`)}</SelectTrigger>
        <SelectContent>
          {ENTITLEMENT_KINDS.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`kind.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {options.length > 0 ? (
        <Select value={resourceKey} onValueChange={onResourceKeyChange}>
          <SelectTrigger aria-label={t("resourceLabel")}>
            <span className={selected ? undefined : "text-muted-foreground"}>
              {selected?.label ?? t("resourcePlaceholder")}
            </span>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={resourceKey}
          onChange={(event) => onResourceKeyChange(event.target.value)}
          placeholder={t("skillSlugPlaceholder")}
          aria-label={t("resourceLabel")}
        />
      )}
    </div>
  );
}
