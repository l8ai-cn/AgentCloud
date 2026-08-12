import Link from "next/link";
import { Loader2, RefreshCw, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { MarketplaceModelResource } from "@/lib/marketplace-model-resources";

export function MarketplaceModelResourceField({
  resources,
  value,
  onChange,
  loading,
  error,
  incompatibleListing,
  onReload,
  settingsHref,
}: {
  resources: MarketplaceModelResource[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  incompatibleListing: boolean;
  onReload: () => void;
  settingsHref: string;
}) {
  const t = useTranslations("marketplace");
  if (incompatibleListing) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-bg p-5 text-sm text-foreground">
        {t("acquire.incompatibleListing")}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("acquire.loadingCompatibleModels")}
      </div>
    );
  }
  if (error) {
    return (
      <Button className="w-full gap-2" variant="outline" onClick={onReload}>
        <RefreshCw className="h-4 w-4" />
        {t("reloadModels")}
      </Button>
    );
  }
  if (resources.length === 0) {
    return (
      <Button asChild className="w-full gap-2" variant="outline">
        <Link href={settingsHref}>
          <Settings2 className="h-4 w-4" />
          {t("configureCompatibleModel")}
        </Link>
      </Button>
    );
  }
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      aria-label={t("selectRuntimeModel")}
    >
      <option value="">{t("selectRuntimeModel")}</option>
      {resources.map((resource) => (
        <option key={resource.id} value={resource.id}>
          {resource.label}
        </option>
      ))}
    </select>
  );
}
