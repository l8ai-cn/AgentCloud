"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { McpMarketItem } from "@/lib/api";
import { listMarketMcpServers } from "@/lib/api/facade/marketExtension";
import { useCurrentOrg } from "@/stores/auth";

const PAGE_SIZE = 50;

export function useConnectionMarket() {
  const currentOrg = useCurrentOrg();
  const orgSlug = currentOrg?.slug ?? "";
  const [items, setItems] = useState<McpMarketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const offsetRef = useRef(0);

  const load = useCallback(
    async (opts: { append?: boolean; query?: string; category?: string | null; mounted?: { current: boolean } } = {}) => {
      if (!orgSlug) return;
      const append = opts.append === true;
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          offsetRef.current = 0;
        }
        const res = await listMarketMcpServers(orgSlug, {
          query: opts.query,
          category: opts.category ?? undefined,
          limit: PAGE_SIZE,
          offset: offsetRef.current,
        });
        if (opts.mounted && !opts.mounted.current) return;
        if (append) {
          setItems((prev) => [...prev, ...res.items]);
        } else {
          setItems(res.items);
        }
        setTotal(res.total);
        offsetRef.current += res.items.length;
        if (!opts.category) {
          setCategories((prev) => {
            const next = new Set(append ? prev : []);
            for (const item of res.items) {
              if (item.category) next.add(item.category);
            }
            return Array.from(next).sort();
          });
        }
      } catch (error) {
        if (opts.mounted && !opts.mounted.current) return;
        console.error("Failed to load connection market:", error);
      } finally {
        if (!opts.mounted || opts.mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [orgSlug],
  );

  useEffect(() => {
    const mounted = { current: true };
    const timer = setTimeout(() => {
      load({ query: search || undefined, category, mounted });
    }, 300);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [search, category, load]);

  return {
    items,
    total,
    loading,
    loadingMore,
    search,
    setSearch,
    category,
    setCategory,
    categories,
    hasMore: items.length < total,
    loadMore: () => load({ append: true, query: search || undefined, category }),
  };
}
