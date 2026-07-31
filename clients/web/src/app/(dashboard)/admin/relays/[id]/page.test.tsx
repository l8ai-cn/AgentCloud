import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRelay = vi.fn();
const forceUnregisterRelay = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "relay-1" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api/admin/relays", () => ({
  getRelay: (...args: unknown[]) => getRelay(...args),
  forceUnregisterRelay: (...args: unknown[]) => forceUnregisterRelay(...args),
}));

import RelayDetailPage from "./page";

const relay = {
  id: "relay-1",
  url: "wss://relay.example.com",
  region: "us-east",
  capacity: 100,
  connections: 12,
  cpu_usage: 15,
  memory_usage: 24,
  last_heartbeat: "2026-07-30T00:00:00Z",
  healthy: true,
  avg_latency_ms: 18,
  latitude: 40.7128,
  longitude: -74.006,
};

describe("RelayDetailPage", () => {
  beforeEach(() => {
    getRelay.mockReset();
    forceUnregisterRelay.mockReset();
    push.mockReset();
    getRelay.mockResolvedValue(relay);
    forceUnregisterRelay.mockResolvedValue({
      status: "unregistered",
      relay_id: "relay-1",
    });
  });

  it("renders only fields returned by GetRelay", async () => {
    render(<RelayDetailPage />);

    expect(await screen.findByText("wss://relay.example.com")).toBeInTheDocument();
    expect(screen.getByText("12 / 100 (12%)")).toBeInTheDocument();
    expect(screen.getByText("18 ms")).toBeInTheDocument();
    expect(screen.getByText("40.712800")).toBeInTheDocument();
    expect(screen.getByText("-74.006000")).toBeInTheDocument();
    expect(screen.queryByText(/sessions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/migrate/i)).not.toBeInTheDocument();
  });

  it("refreshes the current relay", async () => {
    render(<RelayDetailPage />);
    await screen.findByText("wss://relay.example.com");

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(getRelay).toHaveBeenCalledTimes(2));
    expect(getRelay).toHaveBeenLastCalledWith("relay-1");
  });

  it("confirms force unregister before returning to the list", async () => {
    render(<RelayDetailPage />);
    await screen.findByText("wss://relay.example.com");

    fireEvent.click(screen.getByRole("button", { name: "Force unregister" }));
    expect(forceUnregisterRelay).not.toHaveBeenCalled();
    expect(screen.getByText("Force unregister this relay?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unregister relay" }));

    await waitFor(() => {
      expect(forceUnregisterRelay).toHaveBeenCalledWith("relay-1");
      expect(push).toHaveBeenCalledWith("/admin/relays");
    });
  });

  it("shows a recoverable load error", async () => {
    getRelay.mockRejectedValue(new Error("relay manager unavailable"));

    render(<RelayDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "relay manager unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Back to relays" })).toHaveAttribute(
      "href",
      "/admin/relays",
    );
  });
});
