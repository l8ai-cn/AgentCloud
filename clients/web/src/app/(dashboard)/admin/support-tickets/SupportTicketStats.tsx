import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Clock3, MessageSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { SupportTicketStats as Stats } from "@/lib/api/admin/supportTicketTypes";

const items = [
  {
    key: "total",
    labelKey: "support.stats.total",
    icon: MessageSquare,
    tone: "text-muted-foreground",
  },
  { key: "open", labelKey: "support.stats.open", icon: AlertCircle, tone: "text-danger" },
  {
    key: "in_progress",
    labelKey: "support.stats.inProgress",
    icon: Clock3,
    tone: "text-warning",
  },
  {
    key: "resolved",
    labelKey: "support.stats.resolved",
    icon: CheckCircle2,
    tone: "text-success",
  },
] as const;

export function SupportTicketStats({ stats }: { stats: Stats }) {
  const t = useTranslations("admin");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ key, labelKey, icon: Icon, tone }) => (
        <Card key={key}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t(labelKey)}</p>
              <p className="mt-1 text-2xl font-semibold">
                {stats[key].toLocaleString()}
              </p>
            </div>
            <Icon className={`h-5 w-5 ${tone}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
