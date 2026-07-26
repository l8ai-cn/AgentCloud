import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

function request(host: string, path: string) {
  return new NextRequest(new URL(`https://${host}${path}`), {
    headers: { host },
  });
}

describe("market host middleware", () => {
  it("ignores non-market hosts", () => {
    const response = middleware(request("agents.l8ai.cn", "/apps/foo"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("maps legacy app detail to acquire", () => {
    const response = middleware(request("market.l8ai.cn", "/apps/short-video-director"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://agents.l8ai.cn/marketplace/acquire?listing=short-video-director",
    );
  });

  it("maps catalog root to marketplace", () => {
    const response = middleware(request("market.l8ai.cn", "/catalog"));
    expect(response.headers.get("location")).toBe("https://agents.l8ai.cn/marketplace");
  });
});
