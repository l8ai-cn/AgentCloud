import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExpertReleasePagination({
  total,
  limit,
  offset,
  loading,
  onPrevious,
  onNext,
}: {
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("admin");
  if (total === 0) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const firstItem = offset + 1;
  const lastItem = Math.min(offset + limit, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("expertMarket.showingRange", {
          first: firstItem,
          last: lastItem,
          total,
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("expertMarket.previousPage")}
          title={t("expertMarket.previousPage")}
          disabled={loading || offset === 0}
          onClick={onPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-24 text-center text-sm">
          {t("common.pageOf", { page: currentPage, total: totalPages })}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("expertMarket.nextPage")}
          title={t("expertMarket.nextPage")}
          disabled={loading || offset + limit >= total}
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
