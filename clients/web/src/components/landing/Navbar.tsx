"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Code, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n";
import { LightAuthButtons as AuthButtons } from "@/components/common/LightAuthButtons";
import { Logo } from "@/components/common/Logo";
import { useTranslations } from "next-intl";
import { isMarketingRouteActive, marketingRoutes } from "./marketing-routes";

const SOURCE_URL = "https://cnb.cool/l8ai/agentcloud";

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations();

  const navLinks = marketingRoutes.map(({ href, labelKey }) => ({
    href,
    label: t(labelKey),
  }));

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const surfaceStyle = isMobileMenuOpen
    ? "bg-[var(--expert-bg)]"
    : isScrolled
      ? "bg-[var(--expert-bg)]/95 backdrop-blur-xl"
      : "bg-[var(--expert-bg)]/85 backdrop-blur-md";

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 border-b transition-colors ${surfaceStyle} ${isScrolled || isMobileMenuOpen ? "border-white/10" : "border-transparent"}`}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <Logo />
            </div>
            <span className="text-lg font-semibold text-white">
              Agent Cloud
            </span>
          </Link>

          <div className="hidden items-center gap-5 lg:flex">
            {navLinks.map((link) => {
              const active = isMarketingRouteActive(pathname, link.href);
              const className = `border-b py-1 text-xs font-semibold transition-colors ${
                active
                  ? "border-[var(--expert-action)] text-white"
                  : "border-transparent text-[var(--expert-muted)] hover:border-[var(--expert-action)] hover:text-white"
              }`;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--expert-muted)] transition-colors hover:text-white"
              aria-label="CNB"
            >
              <Code className="h-5 w-5" />
            </a>
            <LanguageSwitcher variant="icon" />
            <AuthButtons size="sm" showRegister className="flex items-center gap-3" />
          </div>

          <button
            className="flex h-11 w-11 items-center justify-center text-[var(--expert-muted)] lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={t("landing.nav.toggleMenu")}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="mt-4 flex max-h-[calc(100dvh-5rem)] flex-col gap-1 overflow-y-auto border-t border-white/10 pt-3 lg:hidden">
            {navLinks.map((link) => {
              const active = isMarketingRouteActive(pathname, link.href);
              const className = `border-b border-white/8 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "text-[var(--expert-action)]"
                  : "text-[var(--expert-muted)] hover:text-white"
              }`;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={className}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-3 pt-3">
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[var(--expert-muted)] transition-colors hover:text-white"
              >
                <Code className="h-5 w-5" />
                {t("landing.footer.resources.github")}
              </a>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-[var(--expert-muted)]">{t("landing.nav.language")}</span>
                <LanguageSwitcher variant="full" />
              </div>
              <AuthButtons
                size="sm"
                showRegister
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex flex-col gap-2 [&_button]:w-full"
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
