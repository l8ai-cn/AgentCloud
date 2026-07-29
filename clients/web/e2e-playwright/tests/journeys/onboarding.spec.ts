// Migrated R5+: Connect-RPC only (no REST middle layer).
import { test, expect } from "../../fixtures/index";
import { clearAuthRateLimit } from "../../helpers/redis";
import {
  CLEANUP,
  PASSWORD123,
  seedPasswordUserSQL,
} from "../../helpers/test-data";
import { DbFixture } from "../../fixtures/db.fixture";
import { getWebBaseUrl } from "../../helpers/env";

/**
 * Journey: first-time workspace creation.
 * Local Register is closed — users are seeded (AMP/SSO in production) then
 * land on onboarding to create a personal org.
 */
test.describe("Journey: New User Onboarding", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const EMAIL = "onboarding-journey@test.local";
  const USERNAME = "journeyuser";

  test.beforeAll(async () => {
    const db = new DbFixture();
    try {
      db.cleanup(CLEANUP.userAndOrgsByEmail(EMAIL));
    } catch {
      /* */
    }
  });

  test.beforeEach(async () => {
    clearAuthRateLimit();
  });

  test("register page redirects to login", async ({ page }) => {
    await page.goto("/register");
    await page.waitForURL((url) => url.pathname.includes("/login"), {
      timeout: 15_000,
    });
    expect(page.url()).toContain("/login");
  });

  test("seeded user can create personal workspace from onboarding", async ({
    page,
    api,
    db,
  }) => {
    try {
      db.cleanup(CLEANUP.userAndOrgsByEmail(EMAIL));
    } catch {
      /* */
    }
    db.setup(
      seedPasswordUserSQL({
        email: EMAIL,
        username: USERNAME,
        name: "Journey Test User",
      }),
    );

    const publicCc = api.connectWithToken("");
    const loginRes = (await publicCc.auth.login({
      username: USERNAME,
      password: PASSWORD123,
    })) as { token: string; refreshToken: string; expiresIn: number | string };

    const baseUrl = getWebBaseUrl();
    const expiresAt =
      Math.floor(Date.now() / 1000) + Number(loginRes.expiresIn ?? 3600);
    await page.context().addInitScript(
      ({ token, refresh_token, expiresAt, baseUrl }) => {
        const u = new URL(baseUrl);
        const port = u.port ? `_${u.port}` : "";
        const raw = `${u.protocol.replace(":", "")}_${u.hostname.toLowerCase()}${port}`;
        const slug = raw.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 64);
        localStorage.setItem(
          `agent-cloud-auth/${slug}/session`,
          JSON.stringify({
            access_token: token,
            refresh_token,
            expires_at: expiresAt,
            base_url: baseUrl,
            current_org_slug: null,
            schema_version: 1,
          }),
        );
      },
      {
        token: loginRes.token,
        refresh_token: loginRes.refreshToken,
        expiresAt,
        baseUrl,
      },
    );

    const personalReq = page.waitForRequest(
      (req) =>
        req.url().endsWith("/proto.org.v1.OrgService/CreatePersonalOrg") &&
        req.method() === "POST",
    );

    await page.goto("/onboarding");
    await page
      .getByRole("button", { name: /Create Personal Workspace|创建个人工作区/i })
      .click();
    const req = await personalReq;
    expect(req.postData()).toBe("{}");
    await page.waitForURL((u) => u.pathname.includes("/workspace"), {
      timeout: 15_000,
    });

    db.cleanup(CLEANUP.userAndOrgsByEmail(EMAIL));
  });
});
