import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JumpToLatest } from "./JumpToLatest";

describe("JumpToLatest", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(
      <JumpToLatest label="Jump to latest" onClick={() => undefined} visible={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onClick when visible", () => {
    const onClick = vi.fn();
    render(
      <JumpToLatest label="Jump to latest" onClick={onClick} visible />,
    );
    screen.getByRole("button", { name: "Jump to latest" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
