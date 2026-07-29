"use client";

import React from "react";
import {
  CircleDashed,
  Minus,
} from "lucide-react";
import type { TicketStatus, TicketPriority } from "@/lib/viewModels/ticket";
import { cn } from "@/lib/utils";
import {
  getTicketPriorityDisplay,
  getTicketStatusDisplay,
} from "@/lib/ticket-display";

type IconSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<IconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

interface StatusIconProps {
  status: TicketStatus;
  size?: IconSize;
  className?: string;
}

export function StatusIcon({ status, size = "sm", className }: StatusIconProps) {
  const display = getTicketStatusDisplay(status);
  const IconComponent = display?.icon ?? CircleDashed;
  const colorClass = display?.color ?? "text-muted-foreground";

  return (
    <IconComponent
      className={cn(
        sizeClasses[size],
        colorClass,
        className
      )}
    />
  );
}

interface PriorityIconProps {
  priority: TicketPriority;
  size?: IconSize;
  className?: string;
}

export function PriorityIcon({ priority, size = "sm", className }: PriorityIconProps) {
  const display = getTicketPriorityDisplay(priority);
  const IconComponent = display?.icon ?? Minus;
  const colorClass = display?.color ?? "text-muted-foreground";

  return (
    <IconComponent
      className={cn(sizeClasses[size], colorClass, className)}
    />
  );
}

export interface StatusInfo {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

export interface PriorityInfo {
  label: string;
  color: string;
  icon: React.ReactNode;
}

type TranslateFn = (key: string) => string;

export function getStatusDisplayInfo(status: TicketStatus, sizeOrT?: IconSize | TranslateFn, maybeSize?: IconSize): StatusInfo {
  let size: IconSize = "sm";
  let t: TranslateFn | undefined;

  if (typeof sizeOrT === "function") {
    t = sizeOrT;
    size = maybeSize || "sm";
  } else if (typeof sizeOrT === "string") {
    size = sizeOrT;
  }

  const display = getTicketStatusDisplay(status);
  const label = t ? t(`tickets.status.${status}`) : display.label;

  return {
    label,
    color: display.color,
    bgColor: display.bgColor,
    icon: <StatusIcon status={status} size={size} />,
  };
}

export function getPriorityDisplayInfo(priority: TicketPriority, sizeOrT?: IconSize | TranslateFn, maybeSize?: IconSize): PriorityInfo {
  let size: IconSize = "sm";
  let t: TranslateFn | undefined;

  if (typeof sizeOrT === "function") {
    t = sizeOrT;
    size = maybeSize || "sm";
  } else if (typeof sizeOrT === "string") {
    size = sizeOrT;
  }

  const display = getTicketPriorityDisplay(priority);
  const label = t ? t(`tickets.priority.${priority}`) : display.label;

  return {
    label,
    color: display.color,
    icon: <PriorityIcon priority={priority} size={size} />,
  };
}
