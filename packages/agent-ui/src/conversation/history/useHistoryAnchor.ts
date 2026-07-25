import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Preserve visual position when older items are prepended. Capture must happen
 * during render (before paint of the new items); restore in useLayoutEffect.
 */
export function useHistoryAnchor(
  el: RefObject<HTMLElement | null>,
  itemCount: number,
  loadingOlder: boolean,
): void {
  const before = useRef<{ height: number; top: number } | null>(null);

  if (loadingOlder && el.current && !before.current) {
    before.current = {
      height: el.current.scrollHeight,
      top: el.current.scrollTop,
    };
  }

  useLayoutEffect(() => {
    const node = el.current;
    const prev = before.current;
    if (!node || !prev) return;
    node.scrollTop = prev.top + (node.scrollHeight - prev.height);
    before.current = null;
  }, [el, itemCount]);
}
