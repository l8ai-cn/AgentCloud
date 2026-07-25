const ACTIVE_POD_STATUSES = new Set([
  "queued",
  "initializing",
  "running",
  "paused",
  "disconnected",
]);

const RELAY_CONNECTABLE_POD_STATUSES = new Set([
  "running",
  "paused",
  "disconnected",
]);

export function isPodActive(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_POD_STATUSES.has(status));
}

export function isPodRelayConnectable(status: string | null | undefined): boolean {
  return Boolean(status && RELAY_CONNECTABLE_POD_STATUSES.has(status));
}
