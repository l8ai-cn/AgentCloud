// Local password registration is closed. Identity is provisioned through AMP/SSO.
import { test, expect } from "../../fixtures/index";
import { ConnectError } from "../../helpers/connect-client";

test.describe("Registration Flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("register page redirects to login", async ({ page }) => {
    await page.goto("/register");
    await page.waitForURL((url) => url.pathname.includes("/login"));
    expect(page.url()).toContain("/login");
  });

  test("Connect Register returns FailedPrecondition", async ({ api }) => {
    const cc = api.connectWithToken("");
    await expect(
      cc.auth.register({
        email: "closed-register@test.local",
        username: "closedregister",
        password: "password123",
        name: "Closed",
      }),
    ).rejects.toBeInstanceOf(ConnectError);
  });
});
