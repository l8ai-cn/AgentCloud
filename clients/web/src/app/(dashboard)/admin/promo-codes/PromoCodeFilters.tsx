import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { PromoCodeType } from "@/lib/api/admin/promoTypes";
import { promoTypeLabels } from "./promoCodePresentation";

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
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search code or name"
          className="pl-9"
          aria-label="Search promo codes"
        />
      </div>
      <Select
        value={props.type}
        disabled={props.disabled}
        onValueChange={(value) => props.onTypeChange(value as PromoTypeFilter)}
      >
        <SelectTrigger aria-label="Filter by type">
          {props.type === "all" ? "All types" : promoTypeLabels[props.type]}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(promoTypeLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={props.plan}
        disabled={props.disabled}
        onValueChange={(value) => props.onPlanChange(value as PromoPlanFilter)}
      >
        <SelectTrigger aria-label="Filter by plan">
          {props.plan === "all" ? "All plans" : props.plan}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All plans</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={props.status}
        disabled={props.disabled}
        onValueChange={(value) =>
          props.onStatusChange(value as PromoStatusFilter)
        }
      >
        <SelectTrigger aria-label="Filter by status">
          {props.status === "all"
            ? "All statuses"
            : props.status === "active"
              ? "Active"
              : "Inactive"}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
