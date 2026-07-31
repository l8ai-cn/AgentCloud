import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { PromoCodeType } from "@/lib/api/admin/promoTypes";
import { promoTypeLabelKeys } from "./promoCodePresentation";

export type PromoStatusFilter = "all" | "active" | "inactive";
export type PromoTypeFilter = "all" | PromoCodeType;
export type PromoPlanFilter = "all" | "pro" | "enterprise";

interface PromoCodeFiltersProps {
  query: string;
  type: PromoTypeFilter;
  plan: PromoPlanFilter;
  status: PromoStatusFilter;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: PromoTypeFilter) => void;
  onPlanChange: (value: PromoPlanFilter) => void;
  onStatusChange: (value: PromoStatusFilter) => void;
}

export function PromoCodeFilters(props: PromoCodeFiltersProps) {
  const t = useTranslations("admin");

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder={t("promoCodes.filters.searchPlaceholder")}
          className="pl-9"
          aria-label={t("promoCodes.filters.searchLabel")}
        />
      </div>
      <Select
        value={props.type}
        disabled={props.disabled}
        onValueChange={(value) => props.onTypeChange(value as PromoTypeFilter)}
      >
        <SelectTrigger aria-label={t("promoCodes.filters.typeLabel")}>
          {props.type === "all"
            ? t("promoCodes.filters.allTypes")
            : t(promoTypeLabelKeys[props.type])}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("promoCodes.filters.allTypes")}</SelectItem>
          {Object.entries(promoTypeLabelKeys).map(([value, labelKey]) => (
            <SelectItem key={value} value={value}>
              {t(labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={props.plan}
        disabled={props.disabled}
        onValueChange={(value) => props.onPlanChange(value as PromoPlanFilter)}
      >
        <SelectTrigger aria-label={t("promoCodes.filters.planLabel")}>
          {props.plan === "all"
            ? t("promoCodes.filters.allPlans")
            : props.plan === "pro"
              ? t("promoCodes.filters.selectedPlanPro")
              : t("promoCodes.filters.selectedPlanEnterprise")}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("promoCodes.filters.allPlans")}</SelectItem>
          <SelectItem value="pro">{t("promoCodes.plan.pro")}</SelectItem>
          <SelectItem value="enterprise">
            {t("promoCodes.plan.enterprise")}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={props.status}
        disabled={props.disabled}
        onValueChange={(value) =>
          props.onStatusChange(value as PromoStatusFilter)
        }
      >
        <SelectTrigger aria-label={t("promoCodes.filters.statusLabel")}>
          {props.status === "all"
            ? t("promoCodes.filters.allStatuses")
            : props.status === "active"
              ? t("promoCodes.status.active")
              : t("promoCodes.status.inactive")}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {t("promoCodes.filters.allStatuses")}
          </SelectItem>
          <SelectItem value="active">{t("promoCodes.status.active")}</SelectItem>
          <SelectItem value="inactive">
            {t("promoCodes.status.inactive")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
