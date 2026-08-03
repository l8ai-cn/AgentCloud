import type { TerminalControlLease } from "@agent-cloud/agent-ui";

import {
  clearPendingControl,
  type ControlAction,
  type EmbeddedTerminalConnection,
} from "./embeddedTerminalConnection";
import {
  controlLeaseFromStatus,
  encodeControlLeaseFrame,
  type ControlLeaseStatus,
} from "./relayFrameCodec";

const CONTROL_REQUEST_TIMEOUT_MS = 5_000;

export function requestTerminalControl(
  connection: EmbeddedTerminalConnection,
  action: ControlAction,
  value: string,
): Promise<TerminalControlLease | void> {
  if (connection.pending) throw new Error("A terminal control request is already pending");
  const socket = connection.socket;
  if (!socket) throw new Error("Terminal socket is not available");
  return new Promise((resolve, reject) => {
    const usesClientLabel = action === "acquire" || action === "force_acquire";
    const leaseId = usesClientLabel ? undefined : value;
    const timer = window.setTimeout(() => {
      if (connection.pending?.timer !== timer) return;
      connection.pending = null;
      reject(new Error("Terminal control request timed out"));
    }, CONTROL_REQUEST_TIMEOUT_MS);
    connection.pending = { action, leaseId, reject, resolve, timer };
    const request = usesClientLabel
      ? { action, clientLabel: value }
      : { action, leaseId: value };
    try {
      socket.send(encodeControlLeaseFrame(request));
    } catch (cause) {
      clearPendingControl(connection);
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

export function applyTerminalControlStatus(
  connection: EmbeddedTerminalConnection,
  frame: {
    status: ControlLeaseStatus;
    leaseId?: string;
    expiresAt?: number;
  },
): void {
  const lease = controlLeaseFromStatus(frame);
  if (lease) connection.lease = lease;
  else if (frame.status !== "busy") connection.lease = null;
  const pending = connection.pending;
  if (!pending) return;
  // force_acquire steals via a Released broadcast before Granted
  if (pending.action === "force_acquire" && frame.status === "released") {
    return;
  }
  clearPendingControl(connection);
  if (frame.status === "busy") {
    pending.reject(new Error("Terminal control is busy"));
  } else if (pending.action === "release" && frame.status === "released") {
    pending.resolve();
  } else if (
    lease &&
    (pending.action === "acquire" ||
      pending.action === "force_acquire" ||
      pending.leaseId === lease.leaseId)
  ) {
    pending.resolve(
      pending.action === "acquire" || pending.action === "force_acquire"
        ? lease
        : undefined,
    );
  } else {
    pending.reject(new Error(`Relay rejected terminal control (${frame.status})`));
  }
}

export function requireTerminalLease(
  connection: EmbeddedTerminalConnection,
  resourceId: string,
  leaseId?: string,
): void {
  const lease = connection.lease;
  if (!lease || lease.expiresAt <= Date.now()) {
    connection.lease = null;
    throw new Error(`Terminal ${resourceId} does not hold a valid control lease`);
  }
  if (leaseId && lease.leaseId !== leaseId) {
    throw new Error(`Terminal ${resourceId} does not hold lease ${leaseId}`);
  }
}
