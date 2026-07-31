import { TicketPercent } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/empty-state";
import type { AdminPromoCode } from "@/lib/api/admin/promoTypes";
import { PromoCodeRow } from "./PromoCodeRow";
import type { PromoCodeAction } from "./useAdminPromoCodes";

interface PromoCodeListProps {
  codes: AdminPromoCode[];
  loading: boolean;
  searching: boolean;
  busyId: number | null;
  onAction: (code: AdminPromoCode, action: PromoCodeAction) => void;
}

export function PromoCodeList({
  codes,
  loading,
  searching,
  busyId,
  onAction,
}: PromoCodeListProps) {
  const t = useTranslations("admin");

  if (loading && codes.length === 0) {
    return (
      <div className="space-y-1 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-md bg-surface-muted"
          />
        ))}
      </div>
    );
  }

  if (codes.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<TicketPercent className="h-5 w-5" />}
        title={t("promoCodes.empty.title")}
        description={
          searching
            ? t("promoCodes.empty.searching")
            : t("promoCodes.empty.description")
        }
      />
    );
  }

  return codes.map((code) => (
    <PromoCodeRow
      key={code.id}
      code={code}
      busy={busyId === code.id}
      onAction={onAction}
    />
  ));
}
