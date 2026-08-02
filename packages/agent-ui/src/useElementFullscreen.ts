import { useCallback, useEffect, useState, type RefObject } from "react";

export function useElementFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  // SSR 与 jsdom 都没有 Fullscreen API，mounted 后再探测避免 hydration 不一致
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof document !== "undefined" &&
        !!document.fullscreenEnabled &&
        typeof target.current?.requestFullscreen === "function",
    );
  }, [target]);

  useEffect(() => {
    if (!supported) return;
    const sync = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [supported, target]);

  const toggle = useCallback(() => {
    const element = target.current;
    if (!element || typeof document === "undefined") return;
    if (document.fullscreenElement === element) {
      void document.exitFullscreen?.();
    } else {
      void element.requestFullscreen?.();
    }
  }, [target]);

  return { active, supported, toggle };
}
