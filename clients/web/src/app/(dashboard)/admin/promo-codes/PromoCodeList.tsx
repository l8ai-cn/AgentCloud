import { TicketPercent } from "lucide-react";

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
        title="No promo codes found"
        description={
          searching
            ? "Try changing the search or filters."
            : "Create the first promo code for a subscription campaign."
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
