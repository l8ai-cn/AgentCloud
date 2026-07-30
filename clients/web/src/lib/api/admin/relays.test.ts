import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", async () => {
  const actual = await vi.importActual<typeof import("./transport")>("./transport");
  return {
    ...actual,
    callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
  };
});

import {
  forceUnregisterRelay,
  getRelay,
  getRelayStats,
  listRelays,
} from "./relays";

const relay = {
  id: "relay-1",
  url: "wss://relay.example.com",
  region: "us-east",
  capacity: 100,
  connections: 12,
  cpuUsage: 15,
  memoryUsage: 24,
  lastHeartbeat: "2026-07-30T00:00:00Z",
  healthy: true,
  avgLatencyMs: 18,
  latitude: 40.7128,
  longitude: -74.006,
};

describe("admin relays API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps relay inventory", async () => {
    callAdminConnect.mockResolvedValue({ items: [relay], total: 1 });

    const result = await listRelays();

    expect(result).toEqual({
      total: 1,
      data: [expect.objectContaining({
        id: "relay-1",
        cpu_usage: 15,
        avg_latency_ms: 18,
        latitude: 40.7128,
        longitude: -74.006,
      })],
    });
  });

  it("maps relay statistics", async () => {
    callAdminConnect.mockResolvedValue({
      totalRelays: 3,
      healthyRelays: 2,
      totalConnections: 27,
    });

    await expect(getRelayStats()).resolves.toEqual({
      total_relays: 3,
      healthy_relays: 2,
      total_connections: 27,
    });
  });

  it("fails when a detail response omits the relay", async () => {
    callAdminConnect.mockResolvedValue({});

    await expect(getRelay("missing")).rejects.toThrow("Relay not found");
  });

  it("maps the complete relay detail response", async () => {
    callAdminConnect.mockResolvedValue({ relay });

    await expect(getRelay("relay-1")).resolves.toEqual({
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
    });
    expect(callAdminConnect.mock.calls[0][4]).toEqual({ id: "relay-1" });
  });

  it("unregisters the exact relay id", async () => {
    callAdminConnect.mockResolvedValue({ status: "unregistered", relayId: "relay/special" });

    await expect(forceUnregisterRelay("relay/special")).resolves.toEqual({
      status: "unregistered",
      relay_id: "relay/special",
    });
    expect(callAdminConnect.mock.calls[0][4]).toEqual({ id: "relay/special" });
  });
});
