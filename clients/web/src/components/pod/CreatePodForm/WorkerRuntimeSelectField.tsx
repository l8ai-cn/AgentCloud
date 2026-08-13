"use client";

import { Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { BlockingReasonKind } from "./workerBlockingReasonLabels";

export interface WorkerRuntimeSelectOption {
  value: string;
  label: string;
  selectable: boolean;
  blockingReason: string;
  blockingKind?: BlockingReasonKind;
}

interface WorkerRuntimeSelectFieldProps {
  field: string;
  label: string;
  description?: string;
  value: string;
  options: WorkerRuntimeSelectOption[];
  onChange: (value: string) => void;
}

export function WorkerRuntimeSelectField({
  field,
  label,
  description,
  value,
  options,
  onChange,
}: WorkerRuntimeSelectFieldProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <div data-runtime-field={field}>
      <label htmlFor={`worker-runtime-${field}`} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`worker-runtime-${field}`} aria-label={label}>
          <span className={selected ? undefined : "text-muted-foreground"}>
            {selected?.label ?? label}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={!option.selectable}
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5">
                  {option.blockingKind === "authorization" && !option.selectable && (
                    <Lock className="h-3 w-3 shrink-0 text-warning" />
                  )}
                  {option.label}
                </span>
                {!option.selectable && option.blockingReason && (
                  <span
                    className={
                      option.blockingKind === "authorization"
                        ? "text-xs text-warning"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {option.blockingReason}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
