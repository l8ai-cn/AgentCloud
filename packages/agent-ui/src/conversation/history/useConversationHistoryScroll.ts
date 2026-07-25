import { useCallback, useRef, useState, type RefObject } from "react";

import { useHistoryAnchor } from "./useHistoryAnchor";
import { useJumpToLatest } from "./useJumpToLatest";
import { useLoadOlderTrigger } from "./useLoadOlderTrigger";

export function useConversationHistoryScroll(options: {
  hasOlderItems: boolean;
  itemCount: number;
  loadOlder: () => Promise<void>;
  sessionId: string;
}): {
  loadingOlder: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  showJump: boolean;
  jumpToLatest: () => void;
} {
  const scrollRef = useRef<HTMLElement | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const { hasOlderItems, itemCount, loadOlder, sessionId } = options;
  const loadOlderRef = useRef(loadOlder);
  loadOlderRef.current = loadOlder;

  const runLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasOlderItems) return;
    setLoadingOlder(true);
    try {
      await loadOlderRef.current();
    } finally {
      setLoadingOlder(false);
    }
  }, [hasOlderItems, loadingOlder]);

  useHistoryAnchor(scrollRef, itemCount, loadingOlder);
  useLoadOlderTrigger(scrollRef, hasOlderItems, runLoadOlder, itemCount);
  const { showJump, jumpToLatest } = useJumpToLatest(
    scrollRef,
    itemCount,
    sessionId,
  );

  return { loadingOlder, scrollRef, showJump, jumpToLatest };
}
