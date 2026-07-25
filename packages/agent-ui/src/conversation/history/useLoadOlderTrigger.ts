import { useEffect, useRef, type RefObject } from "react";

export const LOAD_OLDER_TRIGGER_PX = 300;

export function useLoadOlderTrigger(
  el: RefObject<HTMLElement | null>,
  hasOlder: boolean,
  loadOlder: () => Promise<void>,
  itemCount = 0,
): void {
  const inFlight = useRef(false);
  const loadOlderRef = useRef(loadOlder);
  loadOlderRef.current = loadOlder;

  useEffect(() => {
    const node = el.current;
    if (!node || !hasOlder) return;

    const onScroll = () => {
      if (inFlight.current) return;
      if (node.scrollTop > LOAD_OLDER_TRIGGER_PX) return;
      inFlight.current = true;
      void loadOlderRef
        .current()
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => node.removeEventListener("scroll", onScroll);
  }, [el, hasOlder, itemCount]);
}
