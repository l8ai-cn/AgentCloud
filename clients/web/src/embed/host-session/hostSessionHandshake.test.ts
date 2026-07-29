import { describe, expect, it } from "vitest";

import {
  HOST_SESSION_MESSAGE,
  readAllowedHostSessionCredential,
} from "@/embed/host-session/hostSessionHandshake";

const credentialPayload = {
  type: HOST_SESSION_MESSAGE,
  version: 1,
  accessToken: "amp-token",
  orgSlug: "acme",
  podKey: "worker-1",
};

function read(
  overrides: Partial<{ origin: string; source: unknown; data: unknown }> = {},
) {
  return readAllowedHostSessionCredential(
    {
      origin: "https://portal.example",
      source: window.parent,
      data: credentialPayload,
      ...overrides,
    } as Pick<MessageEvent, "origin" | "source" | "data">,
    window.parent,
    ["https://portal.example"],
  );
}

describe("host session handshake", () => {
  it("accepts a credential from the allowed parent origin", () => {
    expect(read()).toEqual({
      accessToken: "amp-token",
      orgSlug: "acme",
      podKey: "worker-1",
    });
  });

  it("rejects a credential from a foreign origin", () => {
    expect(read({ origin: "https://attacker.example" })).toBeNull();
  });

  it("rejects a credential from a window other than the parent", () => {
    expect(read({ source: {} as Window })).toBeNull();
  });

  it("rejects payloads that are not a versioned host-session message", () => {
    expect(read({ data: { ...credentialPayload, type: "agentcloud.embed.open" } })).toBeNull();
    expect(read({ data: { ...credentialPayload, version: 2 } })).toBeNull();
    expect(read({ data: null })).toBeNull();
    expect(read({ data: "amp-token" })).toBeNull();
  });

  it("rejects payloads missing any part of the credential", () => {
    expect(read({ data: { ...credentialPayload, accessToken: "" } })).toBeNull();
    expect(read({ data: { ...credentialPayload, orgSlug: undefined } })).toBeNull();
    expect(read({ data: { ...credentialPayload, podKey: 42 } })).toBeNull();
  });
});
