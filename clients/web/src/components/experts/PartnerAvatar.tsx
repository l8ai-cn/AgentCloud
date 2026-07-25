"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, UserRound } from "lucide-react";
import type { Expert } from "@/lib/api/expertApi";
import { loadExpertAvatarDataUrl } from "@/lib/api/expert-avatar-api";

type AvatarState =
  | { status: "loading"; dataUrl: null }
  | { status: "ready"; dataUrl: string }
  | { status: "error"; dataUrl: null };

export function PartnerAvatar({
  expert,
  orgSlug,
}: {
  expert: Expert;
  orgSlug: string;
}) {
  const avatarPath = expert.metadata?.avatar;

  if (!avatarPath) {
    return (
      <AvatarFrame>
        <UserRound className="h-6 w-6 text-primary" />
      </AvatarFrame>
    );
  }

  return (
    <PartnerAvatarImage
      key={`${expert.slug}:${avatarPath}`}
      expert={expert}
      orgSlug={orgSlug}
      avatarPath={avatarPath}
    />
  );
}

function PartnerAvatarImage({
  expert,
  orgSlug,
  avatarPath,
}: {
  expert: Expert;
  orgSlug: string;
  avatarPath: string;
}) {
  const t = useTranslations("partnerProfile");
  const [state, setState] = useState<AvatarState>({
    status: "loading",
    dataUrl: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    void loadExpertAvatarDataUrl(
      orgSlug,
      expert.slug,
      avatarPath,
      controller.signal,
    )
      .then((dataUrl) => {
        if (!controller.signal.aborted) setState({ status: "ready", dataUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: "error", dataUrl: null });
        }
      });
    return () => controller.abort();
  }, [avatarPath, expert.slug, orgSlug]);

  return (
    <AvatarFrame>
      {state.status === "ready" && (
        <Image
          src={state.dataUrl}
          alt={expert.name}
          width={56}
          height={56}
          unoptimized
          className="h-full w-full object-cover"
        />
      )}
      {state.status === "loading" && (
        <Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />
      )}
      {state.status === "error" && (
        <span
          role="img"
          aria-label={t("avatarLoadFailed")}
          title={t("avatarLoadFailed")}
        >
          <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
        </span>
      )}
    </AvatarFrame>
  );
}

function AvatarFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 ring-1 ring-primary/20">
      {children}
    </div>
  );
}
