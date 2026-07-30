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
  categoryOptions,
  priorityOptions,
  statusOptions,
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
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_11rem_12rem_10rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search ticket titles"
          className="pl-9"
          aria-label="Search support tickets"
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
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
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
        <SelectTrigger aria-label="Filter by category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categoryOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
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
        <SelectTrigger aria-label="Filter by priority">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          {priorityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
