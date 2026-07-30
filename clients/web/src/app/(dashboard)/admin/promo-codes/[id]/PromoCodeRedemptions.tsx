import { Building2, Users } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminPromoCodeRedemption,
  PromoCodePage,
} from "@/lib/api/admin/promoTypes";
import { formatPromoDate } from "../promoCodePresentation";

interface PromoCodeRedemptionsProps {
  data: PromoCodePage<AdminPromoCodeRedemption> | null;
  loading: boolean;
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
}

export function PromoCodeRedemptions({
  data,
  loading,
  error,
  page,
  onPageChange,
}: PromoCodeRedemptionsProps) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Redemptions</h2>
          <p className="text-xs text-muted-foreground">
            {data?.total.toLocaleString() ?? 0} recorded uses
          </p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>
      {error && <AlertMessage type="error" message={error} className="m-4" />}
      {loading && !data ? (
        <div className="space-y-1 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      ) : data?.data.length ? (
        data.data.map((redemption) => (
          <div
            key={redemption.id}
            className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_11rem]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {redemption.user_email ?? `User #${redemption.user_id}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {redemption.user_username
                  ? `@${redemption.user_username}`
                  : "Username unavailable"}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {redemption.organization_name ??
                  `Organization #${redemption.organization_id}`}
              </span>
            </div>
            <div className="text-xs">
              <p className="font-medium capitalize">{redemption.plan_name}</p>
              <p className="text-muted-foreground">
                {redemption.duration_months} months
              </p>
            </div>
            <div className="text-xs">
              <p className="font-medium">{formatPromoDate(redemption.created_at)}</p>
              <p className="text-muted-foreground">
                Ends {formatPromoDate(redemption.new_period_end)}
              </p>
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          size="compact"
          icon={<Users className="h-5 w-5" />}
          title="No redemptions"
          description="This promo code has not been redeemed."
        />
      )}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
}
