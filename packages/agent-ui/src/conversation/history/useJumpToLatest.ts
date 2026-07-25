import { useEffect, useRef, useState, type RefObject } from "react";

const NEAR_BOTTOM_PX = 48;

export function useJumpToLatest(
  el: RefObject<HTMLElement | null>,
  itemCount: number,
  sessionId: string,
): { showJump: boolean; jumpToLatest: () => void } {
  const [showJump, setShowJump] = useState(false);
  const awayRef = useRef(false);
  const countRef = useRef(itemCount);
  const sessionRef = useRef(sessionId);

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      countRef.current = itemCount;
      awayRef.current = false;
      setShowJump(false);
      const node = el.current;
      if (node) node.scrollTop = node.scrollHeight;
      return;
    }

    if (itemCount > countRef.current) {
      const node = el.current;
      if (node && !awayRef.current) {
        const distance =
          node.scrollHeight - node.scrollTop - node.clientHeight;
        if (distance <= NEAR_BOTTOM_PX) {
          node.scrollTop = node.scrollHeight;
        }
      } else if (awayRef.current) {
        setShowJump(true);
      }
    }
    countRef.current = itemCount;
  }, [el, itemCount, sessionId]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;

    const onScroll = () => {
      const distance =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      const away = distance > node.clientHeight;
      awayRef.current = away;
      if (!away) setShowJump(false);
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => node.removeEventListener("scroll", onScroll);
  }, [el, sessionId]);

  return {
    showJump,
    jumpToLatest: () => {
      const node = el.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
      awayRef.current = false;
      setShowJump(false);
    },
  };
}
