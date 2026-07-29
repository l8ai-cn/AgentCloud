import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmbeddedSessionIframe } from "@/embed/embed-session/EmbeddedSessionIframe";

vi.mock("@/embed/host-session/HostSessionIframe", () => ({
  HostSessionIframe: () => <div>Host session</div>,
}));

vi.mock("./EmbedContextSessionIframe", () => ({
  EmbedContextSessionIframe: () => <div>Embed context session</div>,
}));

afterEach(() => {
  window.history.replaceState({}, "", "/iframe");
});

describe("EmbeddedSessionIframe", () => {
  it("routes the host-session flag to the host-session branch", async () => {
    window.history.replaceState({}, "", "/iframe?host_session=1");

    render(<EmbeddedSessionIframe />);

    expect(await screen.findByText("Host session")).toBeInTheDocument();
  });

  it("routes a signed embed context to the embed-context branch", async () => {
    window.history.replaceState({}, "", "/iframe?embed_context=signed-value");

    render(<EmbeddedSessionIframe />);

    expect(await screen.findByText("Embed context session")).toBeInTheDocument();
  });

  it("refuses to choose a branch when both credential sources are present", async () => {
    window.history.replaceState({}, "", "/iframe?host_session=1&embed_context=signed-value");

    render(<EmbeddedSessionIframe />);

    expect(await screen.findByText("无法打开嵌入会话")).toBeInTheDocument();
    expect(screen.queryByText("Host session")).not.toBeInTheDocument();
    expect(screen.queryByText("Embed context session")).not.toBeInTheDocument();
  });
});
