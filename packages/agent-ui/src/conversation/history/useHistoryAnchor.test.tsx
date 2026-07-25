import { act, render, waitFor } from "@testing-library/react";
import { useRef, useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useHistoryAnchor } from "./useHistoryAnchor";

function Harness({
  itemCount,
  loadingOlder,
  children,
}: {
  itemCount: number;
  loadingOlder: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useHistoryAnchor(ref, itemCount, loadingOlder);
  return (
    <div
      data-testid="scroller"
      ref={(node) => {
        ref.current = node;
        if (node) {
          Object.defineProperty(node, "scrollHeight", {
            configurable: true,
            get: () => Number(node.dataset.height ?? "1000"),
          });
        }
      }}
      style={{ height: 200, overflow: "auto" }}
    >
      {children}
    </div>
  );
}

describe("useHistoryAnchor", () => {
  it("compensates scrollTop when older items grow scrollHeight", async () => {
    function Case() {
      const [count, setCount] = useState(2);
      const [loading, setLoading] = useState(false);
      return (
        <>
          <Harness itemCount={count} loadingOlder={loading}>
            <div style={{ height: count * 400 }} />
          </Harness>
          <button
            onClick={() => {
              const node = document.querySelector(
                "[data-testid=scroller]",
              ) as HTMLDivElement;
              node.scrollTop = 100;
              node.dataset.height = "1000";
              setLoading(true);
              queueMicrotask(() => {
                act(() => {
                  node.dataset.height = "1600";
                  setCount(4);
                  setLoading(false);
                });
              });
            }}
            type="button"
          >
            prepend
          </button>
        </>
      );
    }

    const { getByRole, getByTestId } = render(<Case />);
    getByRole("button", { name: "prepend" }).click();

    await waitFor(() => {
      expect(getByTestId("scroller").scrollTop).toBe(700);
    });
  });
});
