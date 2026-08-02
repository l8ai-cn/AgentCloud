"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type TokenQuota,
  deleteTokenQuota,
  listTokenQuotas,
  upsertTokenQuota,
} from "@/lib/api/quotaApi";
import type { TranslationFn } from "./GeneralSettings";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

export function TokenQuotaPanel({ t }: { t: TranslationFn }) {
  const [quotas, setQuotas] = useState<TokenQuota[]>([]);
  const [userId, setUserId] = useState("");
  const [model, setModel] = useState("");
  const [limit, setLimit] = useState("");

  const refresh = useCallback(async () => {
    try {
      setQuotas(await listTokenQuotas());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("settings.usagePage.ceilings.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh]);

  const onSave = async () => {
    if (!limit) {
      toast.error(t("settings.usagePage.ceilings.limitRequired"));
      return;
    }
    try {
      await upsertTokenQuota({
        user_id: userId ? Number(userId) : null,
        model: model.trim() || null,
        limit_tokens: Number(limit),
      });
      setUserId("");
      setModel("");
      setLimit("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("settings.usagePage.ceilings.saveFailed"));
    }
  };

  return (
    <div className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("settings.usagePage.ceilings.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.usagePage.ceilings.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          className={inputCls}
          placeholder={t("settings.usagePage.ceilings.userPlaceholder")}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder={t("settings.usagePage.ceilings.modelPlaceholder")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <input
          className={inputCls}
          type="number"
          placeholder={t("settings.usagePage.ceilings.limitPlaceholder")}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
        <Button onClick={onSave}>{t("settings.usagePage.ceilings.save")}</Button>
      </div>

      <div className="divide-y divide-border">
        {quotas.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            {t("settings.usagePage.ceilings.empty")}
          </p>
        )}
        {quotas.map((q) => (
          <div key={q.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium">
                {q.user_id
                  ? t("settings.usagePage.ceilings.userLabel").replace("{id}", String(q.user_id))
                  : t("settings.usagePage.ceilings.orgLabel")}
              </span>
              <span className="ml-2 text-muted-foreground">
                {q.model
                  ? t("settings.usagePage.ceilings.modelScoped").replace("{model}", q.model)
                  : t("settings.usagePage.ceilings.allModels")}{" "}
                · {q.limit_tokens.toLocaleString()} {t("settings.usagePage.ceilings.tokensUnit")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await deleteTokenQuota(q.id);
                  await refresh();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : t("settings.usagePage.ceilings.deleteFailed"),
                  );
                }
              }}
            >
              {t("settings.usagePage.ceilings.delete")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
