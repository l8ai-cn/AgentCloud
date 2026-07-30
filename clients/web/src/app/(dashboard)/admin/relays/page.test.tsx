import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRelays = vi.fn();
const getRelayStats = vi.fn();

vi.mock("@/lib/api/admin/relays", () => ({
  listRelays: (...args: unknown[]) => listRelays(...args),
  getRelayStats: (...args: unknown[]) => getRelayStats(...args),
  forceUnregisterRelay: vi.fn(),
}));

import RelaysPage from "./page";

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

describe("RelaysPage", () => {
  beforeEach(() => {
    listRelays.mockReset();
    getRelayStats.mockReset();
    listRelays.mockResolvedValue({ data: [relay], total: 1 });
    getRelayStats.mockResolvedValue({
      total_relays: 1,
      healthy_relays: 1,
      total_connections: 12,
    });
  });

  it("links each relay row to its real detail page", async () => {
    render(<RelaysPage />);

    const link = await screen.findByRole("link", {
      name: "View relay-1 details",
    });

    expect(link).toHaveAttribute("href", "/admin/relays/relay-1");
    expect(screen.queryByText(/active sessions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/migrate/i)).not.toBeInTheDocument();
  });
});
