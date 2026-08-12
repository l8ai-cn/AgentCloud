import type { MarketplaceToolModelGroup } from "@/lib/marketplace-tool-model-resources";
import { useTranslations } from "next-intl";

export function MarketplaceToolModelFields({
  groups,
  values,
  onChange,
  disabled,
}: {
  groups: MarketplaceToolModelGroup[];
  values: Record<string, string>;
  onChange: (role: string, value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("marketplace");
  return groups.map((group) => {
    const label = toolModelLabel(group.role, t);
    return (
      <label key={group.role} className="block space-y-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <select
          value={values[group.role] ?? ""}
          onChange={(event) => onChange(group.role, event.target.value)}
          disabled={disabled}
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label={label}
        >
          <option value="">{t("selectToolModel")}</option>
          {group.resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.label}
            </option>
          ))}
        </select>
      </label>
    );
  });
}

function toolModelLabel(
  role: string,
  t: (key: "videoGenerationModel") => string,
): string {
  if (role === "seedance-video") return t("videoGenerationModel");
  return role
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
