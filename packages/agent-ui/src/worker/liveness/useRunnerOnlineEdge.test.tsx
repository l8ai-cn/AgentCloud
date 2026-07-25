import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { useRunnerOnlineEdge } from "./useRunnerOnlineEdge";

function Probe({
  online,
  refresh,
}: {
  online: boolean | undefined;
  refresh: () => void;
}) {
  useRunnerOnlineEdge(online, refresh);
  return null;
}

describe("useRunnerOnlineEdge", () => {
  it("fires only on rising edges", () => {
    const refresh = vi.fn();
    const view = render(<Probe online={undefined} refresh={refresh} />);
    expect(refresh).not.toHaveBeenCalled();

    view.rerender(<Probe online={false} refresh={refresh} />);
    expect(refresh).not.toHaveBeenCalled();

    view.rerender(<Probe online={true} refresh={refresh} />);
    expect(refresh).toHaveBeenCalledTimes(1);

    view.rerender(<Probe online={true} refresh={refresh} />);
    expect(refresh).toHaveBeenCalledTimes(1);

    view.rerender(<Probe online={false} refresh={refresh} />);
    view.rerender(<Probe online={true} refresh={refresh} />);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
