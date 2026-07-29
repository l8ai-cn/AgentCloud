import { describe, expect, it } from "vitest";

import { createHostSessionCredentialStore } from "@/embed/host-session/hostSessionCredentialStore";
import { readHostSessionParentOrigin } from "@/embed/host-session/hostSessionParentOrigin";

const first = { accessToken: "amp-token-1", orgSlug: "acme", podKey: "worker-1" };

describe("host session credential store", () => {
  it("establishes the identity from the first credential", () => {
    const store = createHostSessionCredentialStore();

    expect(store.accept(first)).toEqual({
      kind: "established",
      identity: { orgSlug: "acme", podKey: "worker-1" },
    });
    expect(store.getAccessToken()).toBe("amp-token-1");
  });

  it("swaps the bearer in place when the host rotates it", () => {
    const store = createHostSessionCredentialStore();
    store.accept(first);
    const read = store.getAccessToken;

    expect(store.accept({ ...first, accessToken: "amp-token-2" })).toEqual({
      kind: "rotated",
    });
    expect(read()).toBe("amp-token-2");
    expect(store.getAccessToken).toBe(read);
  });

  it("refuses a credential that repoints the session at another pod or org", () => {
    const store = createHostSessionCredentialStore();
    store.accept(first);

    expect(store.accept({ ...first, podKey: "worker-2" })).toEqual({
      kind: "identity-conflict",
    });
    expect(store.accept({ ...first, orgSlug: "other" })).toEqual({
      kind: "identity-conflict",
    });
    expect(store.getAccessToken()).toBe("amp-token-1");
  });

  it("has no bearer before the host delivers one", () => {
    expect(() => createHostSessionCredentialStore().getAccessToken()).toThrow(
      "host_session_credential_missing",
    );
  });
});

describe("host session parent origin", () => {
  it("binds the handshake to the embedding document origin", () => {
    expect(readHostSessionParentOrigin("https://portal.example/lab/42")).toBe(
      "https://portal.example",
    );
  });

  it("fails when the host stripped the referrer", () => {
    expect(() => readHostSessionParentOrigin("")).toThrow(
      "host_session_parent_origin_unavailable",
    );
    expect(() => readHostSessionParentOrigin("about:blank")).toThrow(
      "host_session_parent_origin_unavailable",
    );
  });
});
