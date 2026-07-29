import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HostSessionIframe } from "@/embed/host-session/HostSessionIframe";

const renderedAccess = vi.hoisted(() => [] as unknown[]);

vi.mock("@/embed/embed-session/EmbeddedAgentWorkspace", () => ({
  EmbeddedAgentWorkspace: ({ access }: { access: unknown }) => {
    renderedAccess.push(access);
    return <div>Workspace</div>;
  },
}));

const HOST_ORIGIN = "https://portal.example";
const WAITING = "正在等待嵌入页面建立连接…";
const FAILED = "无法打开嵌入会话";

let parent: Window;

function hostSessionMessage(accessToken: string, origin = HOST_ORIGIN, source = parent) {
  return new MessageEvent("message", {
    data: {
      type: "agentcloud.embed.host-session",
      version: 1,
      accessToken,
      orgSlug: "acme",
      podKey: "worker-1",
    },
    origin,
    source,
  });
}

function readToken(access: unknown): string {
  return (access as { getAccessToken(): string }).getAccessToken();
}

function stubReferrer(value: string) {
  Object.defineProperty(document, "referrer", { configurable: true, value });
}

beforeEach(() => {
  parent = { postMessage: vi.fn() } as unknown as Window;
  vi.stubGlobal("parent", parent);
  stubReferrer(`${HOST_ORIGIN}/lab/42`);
});

afterEach(() => {
  renderedAccess.length = 0;
  vi.unstubAllGlobals();
  stubReferrer("");
});

describe("HostSessionIframe", () => {
  it("opens the workspace on a host-supplied bearer without redeeming an embed context", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "conv_live" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    render(<HostSessionIframe />);

    expect(screen.getByText(WAITING)).toBeInTheDocument();
    await waitFor(() =>
      expect(parent.postMessage).toHaveBeenCalledWith(
        { type: "agentcloud.embed.ready", version: 1 },
        HOST_ORIGIN,
      ),
    );

    act(() => {
      window.dispatchEvent(hostSessionMessage("amp-token-1"));
    });

    expect(await screen.findByText("Workspace")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/v1/sessions/by-pod/worker-1", {
      headers: {
        Authorization: "Bearer amp-token-1",
        "X-Organization-Slug": "acme",
      },
      cache: "no-store",
    });
    expect(renderedAccess.at(-1)).toMatchObject({
      baseUrl: window.location.origin,
      orgSlug: "acme",
      sessionId: "conv_live",
      sessionApi: {
        requestHeaders: { "X-Organization-Slug": "acme" },
        sessionPath: "/v1/sessions/conv_live",
      },
    });
  });

  it("swaps the bearer on a re-pushed credential without rebuilding the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ id: "conv_live" }), { status: 200 })),
    );

    render(<HostSessionIframe />);
    await waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
    act(() => {
      window.dispatchEvent(hostSessionMessage("amp-token-1"));
    });
    await screen.findByText("Workspace");
    const access = renderedAccess.at(-1);
    expect(readToken(access)).toBe("amp-token-1");

    act(() => {
      window.dispatchEvent(hostSessionMessage("amp-token-2"));
    });

    expect(readToken(access)).toBe("amp-token-2");
    expect(renderedAccess).toHaveLength(1);
    expect(renderedAccess.at(-1)).toBe(access);
  });

  it("ignores credentials from a foreign origin or a non-parent window", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    render(<HostSessionIframe />);
    await waitFor(() => expect(parent.postMessage).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(hostSessionMessage("stolen", "https://attacker.example"));
      window.dispatchEvent(
        hostSessionMessage("stolen", HOST_ORIGIN, {} as unknown as Window),
      );
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it("surfaces an error when the pod lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

    render(<HostSessionIframe />);
    await waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
    act(() => {
      window.dispatchEvent(hostSessionMessage("amp-token-1"));
    });

    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
  });

  it("refuses to run when the host stripped the referrer", async () => {
    stubReferrer("");
    vi.stubGlobal("fetch", vi.fn());

    render(<HostSessionIframe />);

    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});
