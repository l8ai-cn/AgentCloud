import { test, expect } from "../../fixtures/index";
import {
  CLEANUP,
  seedPasswordUserSQL,
  uniqueSuffix,
} from "../../helpers/test-data";

const suffix = uniqueSuffix();
const email = `admin-lifecycle-${suffix}@test.local`;
const username = `admin-lifecycle-${suffix}`;

test.describe("System administration · user lifecycle", () => {
  test.beforeEach(async ({ db }) => {
    db.setup(seedPasswordUserSQL({ email, username, name: "Lifecycle Target" }));
  });

  test.afterEach(async ({ db }) => {
    try {
      db.cleanup(CLEANUP.userByEmail(email));
    } catch {
      // The user row may already be gone when a seed failed.
    }
  });

  test("gates account and privilege changes behind confirmation", async ({ page, db }) => {
    await page.goto("/admin/users");
    await page.getByRole("textbox", { name: "Search users" }).fill(email);

    const row = page.locator("div").filter({ hasText: email }).last();
    await expect(row).toBeVisible();
    const actions = page.getByRole("button", { name: new RegExp(email) });

    await actions.click();
    await page.getByRole("menuitem", { name: "Disable account" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(
      db.queryValue(`SELECT is_active FROM users WHERE email = '${email}'`),
    ).toBe("t");

    await actions.click();
    await page.getByRole("menuitem", { name: "Disable account" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("Disabled")).toBeVisible();
    await expect
      .poll(() => db.queryValue(`SELECT is_active FROM users WHERE email = '${email}'`))
      .toBe("f");

    await actions.click();
    await page.getByRole("menuitem", { name: "Enable account" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("Disabled")).toHaveCount(0);

    await actions.click();
    await page.getByRole("menuitem", { name: "Grant admin access" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("System admin")).toBeVisible();
    await expect
      .poll(() =>
        db.queryValue(`SELECT is_system_admin FROM users WHERE email = '${email}'`),
      )
      .toBe("t");

    await actions.click();
    await page.getByRole("menuitem", { name: "Revoke admin access" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("System admin")).toHaveCount(0);
    await expect
      .poll(() =>
        db.queryValue(`SELECT is_system_admin FROM users WHERE email = '${email}'`),
      )
      .toBe("f");
  });

  test("records the privilege change in the audit log", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("textbox", { name: "Search users" }).fill(email);
    const actions = page.getByRole("button", { name: new RegExp(email) });

    await actions.click();
    await page.getByRole("menuitem", { name: "Grant admin access" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.locator("div").filter({ hasText: email }).last().getByText("System admin"),
    ).toBeVisible();

    await page.goto("/admin/audit-logs");
    await page.getByRole("button", { name: "Users", exact: true }).click();
    await expect(page.getByText("user.grant_admin").first()).toBeVisible();
  });
});
