import { fireEvent, render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerControlOverlay } from "./WorkerControlOverlay";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  forceAcquire: vi.fn(),
  lease: {
    status: "observer",
    connected: true,
    acquiring: false,
    error: null,
  },
}));

function lease() {
  return {
    ...mocks.lease,
    acquire: mocks.acquire,
    forceAcquire: mocks.forceAcquire,
  };
}

describe("WorkerControlOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lease = {
      status: "observer",
      connected: true,
      acquiring: false,
      error: null,
    };
  });

  it("force-acquires control from observer mode", () => {
    render(<WorkerControlOverlay lease={lease()} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(mocks.forceAcquire).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("disables control while the relay is disconnected", () => {
    mocks.lease.connected = false;

    render(<WorkerControlOverlay lease={lease()} />);

    expect(screen.getByRole("button", { name: "Unlock" })).toBeDisabled();
    expect(screen.getByText("Waiting for the Worker connection.")).toBeInTheDocument();
  });

  it("force-acquires control when another device is busy", () => {
    mocks.lease.status = "busy";

    render(<WorkerControlOverlay lease={lease()} />);

    expect(screen.getByText("Another device has control")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(mocks.forceAcquire).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("does not cover a client that owns the lease", () => {
    mocks.lease.status = "granted";

    const { container } = render(
      <WorkerControlOverlay lease={lease()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the panel header interactive in observer mode", () => {
    const { container } = render(
      <WorkerControlOverlay
        lease={lease()}
        preserveHeader
      />,
    );

    expect(container.firstChild).toHaveClass("top-8");
    expect(container.firstChild).not.toHaveClass("top-0");
  });

  it("keeps the workbench browsable in compact observer mode", () => {
    const { container } = render(
      <WorkerControlOverlay blocking={false} lease={lease()} />,
    );

    expect(container.firstChild).toHaveClass("pointer-events-none");
    expect(container.firstChild).toHaveClass("max-sm:right-3");
    expect(container.querySelector(".pointer-events-auto")).toBeInTheDocument();
  });
});
