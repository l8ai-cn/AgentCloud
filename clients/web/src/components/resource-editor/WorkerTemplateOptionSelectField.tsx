"use client";

import { Lock } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { BlockingReasonKind } from "@/components/pod/CreatePodForm/workerBlockingReasonLabels";

export interface WorkerTemplateOption {
  value: string;
  label: string;
  selectable: boolean;
  blockingReason: string;
  blockingKind?: BlockingReasonKind;
}

interface WorkerTemplateOptionSelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: WorkerTemplateOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function WorkerTemplateOptionSelectField({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: WorkerTemplateOptionSelectFieldProps) {
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? (value || label);

  return (
    <FormField
      label={label}
      htmlFor={id}
      required
      className="flex-1"
      error={!selected?.selectable && selected?.blockingReason
        ? selected.blockingReason
        : undefined}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label}>
          <span className={!selected ? "text-muted-foreground" : undefined}>
            {selectedLabel}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={!option.selectable}
              aria-disabled={!option.selectable}
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
    </FormField>
  );
}
