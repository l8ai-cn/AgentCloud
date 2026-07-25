import { beforeEach, describe, expect, it, vi } from "vitest";

const authManager = {
  get_token: vi.fn<() => string | null>(),
};
const getMe = vi.fn();

vi.mock("@/lib/wasm-core", () => ({
  getAuthManager: () => authManager,
}));
vi.mock("@/lib/api", () => ({
  userApi: { getMe },
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { _tick: number }) => unknown) =>
    selector({ _tick: 0 }),
}));

describe("resolveIsSystemAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("shares one request within the same access token", async () => {
    authManager.get_token.mockReturnValue("token-a");
    getMe.mockResolvedValue({ user: { is_system_admin: true } });
    const { resolveIsSystemAdmin } = await import("../useIsSystemAdmin");

    await expect(resolveIsSystemAdmin()).resolves.toBe(true);
    await expect(resolveIsSystemAdmin()).resolves.toBe(true);

    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an administrator result across sessions", async () => {
    authManager.get_token.mockReturnValue("token-a");
    getMe.mockResolvedValueOnce({ user: { is_system_admin: true } });
    const { resolveIsSystemAdmin } = await import("../useIsSystemAdmin");
    await expect(resolveIsSystemAdmin()).resolves.toBe(true);

    authManager.get_token.mockReturnValue("token-b");
    getMe.mockResolvedValueOnce({ user: { is_system_admin: false } });
    await expect(resolveIsSystemAdmin()).resolves.toBe(false);

    expect(getMe).toHaveBeenCalledTimes(2);
  });
});
