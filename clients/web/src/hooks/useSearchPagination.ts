"use client";

import { useEffect, useState } from "react";

export function useSearchPagination(delayMs = 300) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [query, delayMs]);

  return { query, setQuery, search, page, setPage };
}
