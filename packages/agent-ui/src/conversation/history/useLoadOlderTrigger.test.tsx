import { render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  LOAD_OLDER_TRIGGER_PX,
  useLoadOlderTrigger,
} from "./useLoadOlderTrigger";

function Harness({
  hasOlder,
  loadOlder,
  itemCount,
  scrollTop,
}: {
  hasOlder: boolean;
  loadOlder: () => Promise<void>;
  itemCount: number;
  scrollTop: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLoadOlderTrigger(ref, hasOlder, loadOlder, itemCount);
  return (
    <div
      data-testid="scroller"
      ref={(node) => {
        ref.current = node;
        if (node) node.scrollTop = scrollTop;
      }}
      style={{ height: 200, overflow: "auto" }}
    >
      <div style={{ height: 2000 }} />
    </div>
  );
}

describe("useLoadOlderTrigger", () => {
  it("loads when mounted near the top", async () => {
    const loadOlder = vi.fn(async () => undefined);
    render(
      <Harness
        hasOlder
        itemCount={3}
        loadOlder={loadOlder}
        scrollTop={LOAD_OLDER_TRIGGER_PX - 1}
      />,
    );
    await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1));
  });

  it("does not load when scrolled past the trigger", async () => {
    const loadOlder = vi.fn(async () => undefined);
    render(
      <Harness
        hasOlder
        itemCount={3}
        loadOlder={loadOlder}
        scrollTop={LOAD_OLDER_TRIGGER_PX + 1}
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it("dedupes in-flight loadOlder calls", async () => {
    let resolveLoad!: () => void;
    const loadOlder = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const { getByTestId } = render(
      <Harness hasOlder itemCount={3} loadOlder={loadOlder} scrollTop={0} />,
    );
    await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1));
    getByTestId("scroller").dispatchEvent(new Event("scroll"));
    getByTestId("scroller").dispatchEvent(new Event("scroll"));
    expect(loadOlder).toHaveBeenCalledTimes(1);
    resolveLoad();
  });
});
