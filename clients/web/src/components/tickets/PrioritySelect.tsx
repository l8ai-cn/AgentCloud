"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { TicketPriority } from "@/stores/ticket";
import {
  ChevronDown as ChevronDownIcon,
  Loader2,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getTicketPriorityDisplay,
  TICKET_PRIORITY_ORDER,
} from "@/lib/ticket-display";

interface PrioritySelectProps {
  value: TicketPriority;
  onChange: (priority: TicketPriority) => Promise<void>;
  disabled?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const priorityOrder = [...TICKET_PRIORITY_ORDER].reverse();

const sizeClasses = {
  sm: "h-6 text-xs",
  md: "h-8 text-sm",
  lg: "h-10 text-base",
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function PrioritySelect({
  value,
  onChange,
  disabled = false,
  showLabel = true,
  size = "md",
}: PrioritySelectProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentConfig = getTicketPriorityDisplay(value);
  const PriorityIcon = currentConfig.icon;

  const handleSelect = useCallback(async (priority: TicketPriority) => {
    if (priority === value || disabled) return;

    setIsUpdating(true);
    setIsOpen(false);

    try {
      await onChange(priority);
    } catch (error) {
      console.error("Failed to update priority:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [value, onChange, disabled]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        disabled={disabled || isUpdating}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 rounded-md transition-all",
          "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizeClasses[size]
        )}
      >
        {isUpdating ? (
          <Loader2 className={cn("animate-spin", iconSizeClasses[size], currentConfig.color)} />
        ) : (
          <PriorityIcon className={cn(iconSizeClasses[size], currentConfig.color)} />
        )}
        {showLabel && (
          <span className={cn("font-medium", currentConfig.color)}>
            {t(`tickets.priority.${value}`)}
          </span>
        )}
        <ChevronDownIcon className={cn("h-3 w-3 text-muted-foreground", !showLabel && "ml-0.5")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {priorityOrder.map((priority) => {
          const config = getTicketPriorityDisplay(priority);
          const Icon = config.icon;
          const isSelected = priority === value;

          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => handleSelect(priority)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isSelected && "bg-muted"
              )}
            >
              <Icon className={cn("h-4 w-4", config.color)} />
              <span className={isSelected ? "font-medium" : ""}>
                {t(`tickets.priority.${priority}`)}
              </span>
              {isSelected && (
                <Check className="h-3 w-3 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default PrioritySelect;
