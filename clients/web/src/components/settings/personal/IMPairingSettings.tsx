"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pairIMIdentity } from "@/lib/api/imChannelBindingsApi";
import { useTranslations } from "next-intl";

export function IMPairingSettings() {
  const t = useTranslations();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const binding = await pairIMIdentity(code.trim());
      setMessage(
        t("settings.personal.imPair.success", {
          user: binding.external_name || binding.external_user_id,
        })
      );
      setCode("");
    } catch (err) {
      console.error("IM pair failed:", err);
      setError(t("settings.personal.imPair.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card p-6 space-y-4 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold">{t("settings.personal.imPair.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.personal.imPair.description")}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="im-pair-code">{t("settings.personal.imPair.code")}</Label>
        <Input
          id="im-pair-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          className="font-mono tracking-widest uppercase"
          maxLength={8}
        />
      </div>
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={submit} disabled={busy || code.trim().length < 4}>
        {busy ? t("settings.personal.imPair.submitting") : t("settings.personal.imPair.submit")}
      </Button>
    </div>
  );
}
