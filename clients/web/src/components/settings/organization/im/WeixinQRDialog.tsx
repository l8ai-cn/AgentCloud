"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TranslationFn } from "../GeneralSettings";

interface WeixinQRDialogProps {
  open: boolean;
  imageUrl: string;
  message: string;
  status: string;
  t: TranslationFn;
  onClose: () => void;
}

export function WeixinQRDialog({
  open,
  imageUrl,
  message,
  status,
  t,
  onClose,
}: WeixinQRDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("settings.imChannels.weixin.qrTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="WeChat QR"
              className="mx-auto w-56 h-56 border rounded-lg"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.imChannels.loading")}</p>
          )}
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
