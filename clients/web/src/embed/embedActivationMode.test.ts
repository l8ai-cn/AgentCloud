import { describe, expect, it } from "vitest";

import { readEmbedActivationMode } from "@/embed/embedActivationMode";

describe("embed activation mode", () => {
  it("selects host-session mode from the explicit query flag", () => {
    expect(readEmbedActivationMode("?host_session=1")).toBe("host-session");
    expect(readEmbedActivationMode("?host_session=1&theme=dark")).toBe("host-session");
  });

  it("selects embed-context mode when the host-session flag is absent", () => {
    expect(readEmbedActivationMode("?embed_context=signed-value")).toBe("embed-context");
    expect(readEmbedActivationMode("")).toBe("embed-context");
  });

  it("refuses to pick a mode when both credential sources are present", () => {
    expect(() =>
      readEmbedActivationMode("?host_session=1&embed_context=signed-value"),
    ).toThrow("embed_context and host_session are mutually exclusive");
    expect(() =>
      readEmbedActivationMode("?embed_context=signed-value&host_session=1"),
    ).toThrow("embed_context and host_session are mutually exclusive");
  });

  it("rejects a malformed host-session flag", () => {
    expect(() => readEmbedActivationMode("?host_session=1&host_session=1")).toThrow(
      "host_session must appear exactly once",
    );
    expect(() => readEmbedActivationMode("?host_session=true")).toThrow(
      "host_session must be 1",
    );
    expect(() => readEmbedActivationMode("?host_session=")).toThrow(
      "host_session must be 1",
    );
  });

  it("stays on embed-context mode after the context is stripped from the url", () => {
    expect(readEmbedActivationMode("?embed_context=signed-value&theme=dark")).toBe(
      "embed-context",
    );
    expect(readEmbedActivationMode("?theme=dark")).toBe("embed-context");
  });
});
