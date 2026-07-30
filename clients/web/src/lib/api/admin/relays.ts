import {
  ForceUnregisterRelayRequestSchema,
  ForceUnregisterRelayResponseSchema,
  GetRelayRequestSchema,
  GetRelayResponseSchema,
  GetRelayStatsRequestSchema,
  ListRelaysRequestSchema,
  ListRelaysResponseSchema,
  RelayStatsSchema,
  type AdminRelay as ProtoRelay,
} from "@proto/admin/v1/admin_pb";

import { AdminConnectError, callAdminConnect } from "./transport";

const SERVICE = "proto.admin.v1.AdminService";

export interface AdminRelay {
  id: string;
  url: string;
  region: string;
  capacity: number;
  connections: number;
  cpu_usage: number;
  memory_usage: number;
  last_heartbeat: string;
  healthy: boolean;
  avg_latency_ms: number;
}

export interface AdminRelayStats {
  total_relays: number;
  healthy_relays: number;
  total_connections: number;
}

function fromProto(relay: ProtoRelay): AdminRelay {
  return {
    id: relay.id,
    url: relay.url,
    region: relay.region,
    capacity: relay.capacity,
    connections: relay.connections,
    cpu_usage: relay.cpuUsage,
    memory_usage: relay.memoryUsage,
    last_heartbeat: relay.lastHeartbeat,
    healthy: relay.healthy,
    avg_latency_ms: relay.avgLatencyMs,
  };
}

export async function listRelays() {
  const response = await callAdminConnect(
    SERVICE,
    "ListRelays",
    ListRelaysRequestSchema,
    ListRelaysResponseSchema,
    {},
  );
  return { data: response.items.map(fromProto), total: response.total };
}

export async function getRelayStats(): Promise<AdminRelayStats> {
  const response = await callAdminConnect(
    SERVICE,
    "GetRelayStats",
    GetRelayStatsRequestSchema,
    RelayStatsSchema,
    {},
  );
  return {
    total_relays: response.totalRelays,
    healthy_relays: response.healthyRelays,
    total_connections: response.totalConnections,
  };
}

export async function getRelay(id: string): Promise<AdminRelay> {
  const response = await callAdminConnect(
    SERVICE,
    "GetRelay",
    GetRelayRequestSchema,
    GetRelayResponseSchema,
    { id },
  );
  if (!response.relay) {
    throw new AdminConnectError("Relay not found.", "not_found", 404);
  }
  return fromProto(response.relay);
}

export async function forceUnregisterRelay(id: string) {
  const response = await callAdminConnect(
    SERVICE,
    "ForceUnregisterRelay",
    ForceUnregisterRelayRequestSchema,
    ForceUnregisterRelayResponseSchema,
    { id },
  );
  return { status: response.status, relay_id: response.relayId };
}
