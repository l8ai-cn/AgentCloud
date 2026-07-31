import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoryLabelKeys,
  categoryValues,
  priorityLabelKeys,
  priorityValues,
  statusLabelKeys,
  statusValues,
} from "./supportTicketPresentation";
import type { SupportTicketFilters as Filters } from "./useSupportTickets";

interface Props {
  query: string;
  filters: Filters;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: <K extends keyof Omit<Filters, "search">>(
    key: K,
    value: Filters[K],
  ) => void;
}

export function SupportTicketFilters({
  query,
  filters,
  disabled,
  onQueryChange,
  onFilterChange,
}: Props) {
  const t = useTranslations("admin");
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_11rem_12rem_10rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("support.searchPlaceholder")}
          className="pl-9"
          aria-label={t("support.searchAriaLabel")}
          disabled={disabled}
        />
      </div>
      <Select
        value={filters.status}
        onValueChange={(value) =>
          onFilterChange("status", value as Filters["status"])
        }
        disabled={disabled}
      >
        <SelectTrigger aria-label={t("support.filterByStatus")}>
          <SelectValue placeholder={t("support.allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("support.allStatuses")}</SelectItem>
          {statusValues.map((value) => (
            <SelectItem key={value} value={value}>
              {t(statusLabelKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category}
        onValueChange={(value) =>
          onFilterChange("category", value as Filters["category"])
        }
        disabled={disabled}
      >
        <SelectTrigger aria-label={t("support.filterByCategory")}>
          <SelectValue placeholder={t("support.allCategories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("support.allCategories")}</SelectItem>
          {categoryValues.map((value) => (
            <SelectItem key={value} value={value}>
              {t(categoryLabelKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.priority}
        onValueChange={(value) =>
          onFilterChange("priority", value as Filters["priority"])
        }
        disabled={disabled}
      >
        <SelectTrigger aria-label={t("support.filterByPriority")}>
          <SelectValue placeholder={t("support.allPriorities")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("support.allPriorities")}</SelectItem>
          {priorityValues.map((value) => (
            <SelectItem key={value} value={value}>
              {t(priorityLabelKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
