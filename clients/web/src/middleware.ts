import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MARKET_HOSTS = new Set(["market.l8ai.cn"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (!MARKET_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;
  const target = new URL("https://agents.l8ai.cn/marketplace");

  const appMatch = pathname.match(/^\/apps\/([^/]+)\/?$/);
  const listingMatch = pathname.match(/^\/listings\/([^/]+)\/?$/);
  const slug = appMatch?.[1] ?? listingMatch?.[1];
  if (slug) {
    target.pathname = "/marketplace/acquire";
    target.searchParams.set("listing", decodeURIComponent(slug));
    const market = searchParams.get("market");
    const version = searchParams.get("version");
    if (market) target.searchParams.set("market", market);
    if (version) target.searchParams.set("version", version);
    return NextResponse.redirect(target, 308);
  }

  if (pathname === "/" || pathname === "/catalog" || pathname.startsWith("/catalog/")) {
    return NextResponse.redirect(target, 308);
  }

  target.pathname = "/marketplace";
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/", "/catalog", "/catalog/:path*", "/apps/:path*", "/listings/:path*"],
};
