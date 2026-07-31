"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { themeConfigs, type Theme } from "@/lib/theme";

const THEME_ICONS = {
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  palette: Palette,
};

export function MobileThemeMenu() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  const activeConfig = themeConfigs.find((config) => config.id === theme);
  const ActiveIcon = activeConfig ? THEME_ICONS[activeConfig.icon] : Monitor;

  return (
    <div className="relative">
      <button
        className="w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-muted active:bg-muted transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ActiveIcon className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">{t("mobile.menu.theme")}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t(`mobile.menu.theme_${theme || "system"}`)}
        </span>
      </button>

      {open && (
        <div className="ml-14 mr-4 mb-2 bg-secondary rounded-lg overflow-hidden">
          {themeConfigs.map((config) => {
            const Icon = THEME_ICONS[config.icon];
            const isActive = theme === config.id;

            return (
              <button
                key={config.id}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors",
                  isActive && "bg-muted/50"
                )}
                onClick={() => {
                  setTheme(config.id as Theme);
                  setOpen(false);
                }}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {t(`mobile.menu.${config.nameKey}`)}
                </span>
                {isActive && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MobileThemeMenu;
