"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { resourceOptionsFor } from "@/components/entitlement/entitlementResourceOptions";
import {
  ENTITLEMENT_KINDS,
  type EntitlementKind,
} from "@/lib/api/entitlement/entitlementTypes";

interface EntitlementScopePickerProps {
  kind: EntitlementKind;
  resourceKey: string;
  onKindChange: (value: EntitlementKind) => void;
  onResourceKeyChange: (value: string) => void;
}

export function EntitlementScopePicker(props: EntitlementScopePickerProps) {
  const t = useTranslations("admin.entitlements");
  const options = resourceOptionsFor(props.kind);

  return (
    <div className="grid gap-3 md:grid-cols-[12rem_minmax(16rem,1fr)]">
      <Select
        value={props.kind}
        onValueChange={(value) => {
          props.onKindChange(value as EntitlementKind);
          props.onResourceKeyChange("");
        }}
      >
        <SelectTrigger aria-label={t("filters.kindLabel")}>
          {t(`kind.${props.kind}`)}
        </SelectTrigger>
        <SelectContent>
          {ENTITLEMENT_KINDS.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`kind.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {options.length > 0 ? (
        <Select value={props.resourceKey} onValueChange={props.onResourceKeyChange}>
          <SelectTrigger aria-label={t("filters.resourceLabel")}>
            <span className={props.resourceKey ? undefined : "text-muted-foreground"}>
              {options.find((option) => option.value === props.resourceKey)?.label ??
                t("filters.resourcePlaceholder")}
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
          value={props.resourceKey}
          onChange={(event) => props.onResourceKeyChange(event.target.value)}
          placeholder={t("filters.skillSlugPlaceholder")}
          aria-label={t("filters.resourceLabel")}
        />
      )}
    </div>
  );
}
