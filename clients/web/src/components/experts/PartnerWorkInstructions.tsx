"use client";

import { useTranslations } from "next-intl";
import type { Expert } from "@/lib/api/expertApi";

export function PartnerWorkInstructions({ expert }: { expert: Expert }) {
  const t = useTranslations("experts");
  const tp = useTranslations("partnerProfile");
  const prompt = expert.prompt?.trim();
  const agentFile = expert.agentfile_layer?.trim();

  if (!prompt && !agentFile) {
    return <p className="text-sm text-muted-foreground">{tp("noWorkInstructions")}</p>;
  }

  return (
    <div className="space-y-4">
      {prompt && <InstructionBlock label={t("prompt")} value={prompt} />}
      {agentFile && (
        <InstructionBlock label={t("edit.agentfileLayerLabel")} value={agentFile} />
      )}
    </div>
  );
}

function InstructionBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {value}
      </pre>
    </div>
  );
}
