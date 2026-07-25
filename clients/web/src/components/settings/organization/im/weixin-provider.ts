export function isWeixinProvider(type: string): boolean {
  return type === "weixin" || type === "wechat";
}

export function normalizeIMProvider(type: string): string {
  return type === "wechat" ? "weixin" : type;
}
