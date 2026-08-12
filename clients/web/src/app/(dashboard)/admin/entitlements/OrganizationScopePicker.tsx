"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { AdminOrganization } from "@/lib/api/admin/organizations";

interface OrganizationScopePickerProps {
  search: string;
  organizations: AdminOrganization[];
  selectedId: number | null;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
}

export function OrganizationScopePicker({
  search,
  organizations,
  selectedId,
  onSearchChange,
  onSelect,
}: OrganizationScopePickerProps) {
  const t = useTranslations("admin.entitlements");
  const selected = organizations.find((org) => org.id === selectedId);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(16rem,1fr)]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("filters.orgSearchPlaceholder")}
          aria-label={t("filters.orgSearchLabel")}
          className="pl-9"
        />
      </div>
      <Select
        value={selectedId ? String(selectedId) : ""}
        onValueChange={(value) => onSelect(Number(value))}
      >
        <SelectTrigger aria-label={t("filters.orgLabel")}>
          <span className={selected ? undefined : "text-muted-foreground"}>
            {selected ? `${selected.name} (${selected.slug})` : t("filters.orgPlaceholder")}
          </span>
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={String(org.id)}>
              {org.name} ({org.slug})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
