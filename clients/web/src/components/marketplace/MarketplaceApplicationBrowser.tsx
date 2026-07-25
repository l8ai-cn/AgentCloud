"use client";

import { useDeferredValue, useState } from "react";
import { ArrowUpRight, Search, Sparkles, Target, Users, Workflow } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { PublicMarketApplication } from "@/lib/public-market-api";
import { MarketplaceApplicationCard } from "./MarketplaceApplicationCard";

interface Props {
  applications: PublicMarketApplication[];
  loadError?: string;
  loading?: boolean;
}

export function MarketplaceApplicationBrowser({ applications, loadError, loading = false }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const categories = ["全部", ...Array.from(new Set(applications.map((app) => app.category)))];
  const visibleApplications = applications.filter((app) => {
    const matchesCategory = category === "全部" || app.category === category;
    const haystack = [
      app.name,
      app.summary,
      app.description,
      ...app.tags,
      ...app.skill_slugs,
    ].join(" ").toLowerCase();
    return matchesCategory && (!deferredQuery || haystack.includes(deferredQuery));
  });

  return (
    <div className="bg-[var(--expert-bg)] text-white">
      <section className="border-b border-white/10 bg-[var(--expert-bg)] pt-28">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--expert-action)]">
                <Sparkles className="h-4 w-4" />
                Agent Cloud · AI 伙伴目录
              </div>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
                找到一个，马上开始工作。
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--expert-muted)]">
                每个 AI 伙伴都有清晰职责、工作方法和能力边界。先看它能完成什么，再决定是否把它带进团队。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-[var(--expert-muted)]">
              <MarketStat icon={Target} value={applications.length} label="可用伙伴" />
              <MarketStat icon={Workflow} value={categories.length - 1} label="工作领域" />
              <MarketStat icon={Users} value="1→N" label="团队协作" />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索伙伴、任务场景或能力"
                aria-label="搜索 AI 伙伴"
                className="h-12 border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-[var(--expert-muted)]"
              />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="AI 伙伴分类">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={
                    category === item
                      ? "h-9 rounded-md bg-[var(--expert-action)] px-4 text-sm font-semibold text-[var(--expert-ink)]"
                      : "h-9 rounded-md border border-white/10 bg-white/[0.03] px-4 text-sm text-[var(--expert-muted)] hover:border-white/25 hover:text-white"
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <MarketplaceMessage title="正在整理可用伙伴" description="正在加载职责、能力和可启用版本。" />
        ) : loadError ? (
          <MarketplaceMessage
            title="AI 伙伴目录暂时无法加载"
            description="市场服务返回异常，请刷新页面后重试。"
          />
        ) : visibleApplications.length === 0 ? (
          <MarketplaceMessage
            title="还没有匹配的 AI 伙伴"
            description="调整搜索词或切换工作领域后再试。"
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleApplications.map((application) => (
              <MarketplaceApplicationCard key={application.slug} application={application} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MarketplaceMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-white/10 bg-[var(--expert-panel)] px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-[var(--expert-muted)]">{description}</p>
    </div>
  );
}

function MarketStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Target;
  value: number | string;
  label: string;
}) {
  return (
    <div className="border-l border-white/10 pl-3">
      <Icon className="h-4 w-4 text-[var(--expert-action)]" />
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}
