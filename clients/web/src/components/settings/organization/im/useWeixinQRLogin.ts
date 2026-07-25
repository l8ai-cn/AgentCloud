"use client";

import { useEffect, useState } from "react";
import {
  pollWeixinQRLogin,
  startWeixinQRLogin,
  type IMConnection,
} from "@/lib/api/imChannelApi";
import type { TranslationFn } from "../GeneralSettings";

export function useWeixinQRLogin(t: TranslationFn, onConfirmed: () => Promise<void>) {
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrMessage, setQrMessage] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (conn: IMConnection) => {
    setQrLoading(true);
    setQrMessage("");
    setQrStatus("");
    setError(null);
    try {
      const resp = await startWeixinQRLogin(conn.id);
      setQrSessionId(resp.session_id);
      setQrImageUrl(resp.qrcode_url ?? "");
      setQrStatus(resp.status);
      setQrMessage(t("settings.imChannels.weixin.scanHint"));
    } catch (err) {
      console.error("Failed to start weixin QR login:", err);
      setError(t("settings.imChannels.weixin.loginFailed"));
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (!qrSessionId || qrStatus === "confirmed" || qrStatus === "failed" || qrStatus === "timed_out") {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const resp = await pollWeixinQRLogin(qrSessionId);
        setQrStatus(resp.status);
        if (resp.qrcode_url) setQrImageUrl(resp.qrcode_url);
        if (resp.message) setQrMessage(resp.message);
        if (resp.status === "confirmed") {
          setQrMessage(t("settings.imChannels.weixin.loginSuccess"));
          await onConfirmed();
          window.setTimeout(() => setQrSessionId(null), 1500);
        }
        if (resp.status === "failed" || resp.status === "timed_out") {
          setQrMessage(resp.message ?? t("settings.imChannels.weixin.loginFailed"));
        }
      } catch (err) {
        console.error("Weixin QR poll failed:", err);
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [qrSessionId, qrStatus, onConfirmed, t]);

  return {
    qrSessionId,
    qrImageUrl,
    qrStatus,
    qrMessage,
    qrLoading,
    error,
    clearError: () => setError(null),
    close: () => setQrSessionId(null),
    start,
  };
}
