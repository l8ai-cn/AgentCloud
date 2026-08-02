"use client";

import { BookOpen, X } from "lucide-react";
import type { KnowledgeMountSelection } from "@/lib/api/facade/knowledgeBaseApi";
import { mountSlug, sameKnowledgeMount } from "./knowledgeMountSelection";

interface KnowledgeMountChipsProps {
  selectedMounts: KnowledgeMountSelection[];
  knowledgeBases: Array<{ id: number; slug: string }>;
  onChange: (mounts: KnowledgeMountSelection[]) => void;
  t: (key: string) => string;
}

export function KnowledgeMountChips({
  selectedMounts,
  knowledgeBases,
  onChange,
  t,
}: KnowledgeMountChipsProps) {
  if (selectedMounts.length === 0) return null;

  const setMode = (selected: KnowledgeMountSelection, mode: "ro" | "rw") => {
    onChange(
      selectedMounts.map((mount) =>
        sameKnowledgeMount(mount, selected) ? { ...mount, mode } : mount,
      ),
    );
  };

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {selectedMounts.map((m) => (
        <span
          key={m.id ?? m.slug}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs"
        >
          <BookOpen className="h-3 w-3 text-primary" />
          <span className="max-w-[10rem] truncate" title={mountSlug(m, knowledgeBases)}>
            {mountSlug(m, knowledgeBases)}
          </span>
          <button
            type="button"
            className={`rounded px-1 font-mono text-[10px] font-semibold uppercase ${
              m.mode === "rw"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
            onClick={() => setMode(m, m.mode === "rw" ? "ro" : "rw")}
            title={t("ide.createPod.knowledgeModeToggle")}
          >
            {m.mode === "rw"
              ? t("ide.createPod.knowledgeModeReadWrite")
              : t("ide.createPod.knowledgeModeReadOnly")}
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() =>
              onChange(
                selectedMounts.filter((mount) => !sameKnowledgeMount(mount, m)),
              )
            }
            aria-label={t("ide.createPod.removeKnowledgeBase")}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
