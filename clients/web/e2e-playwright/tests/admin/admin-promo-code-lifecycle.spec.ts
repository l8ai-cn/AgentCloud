import { test, expect } from "../../fixtures/index";
import { uniqueSuffix } from "../../helpers/test-data";

const code = `E2EADMIN${uniqueSuffix()}`.replace(/-/g, "").toUpperCase().slice(0, 50);

test.describe("System administration · promo code lifecycle", () => {
  test.afterEach(async ({ db }) => {
    try {
      db.cleanup(`DELETE FROM promo_codes WHERE code = '${code}'`);
    } catch {
      // Already deleted through the UI in the happy path.
    }
  });

  test("creates, deactivates, and deletes a promo code from the console", async ({
    page,
    db,
  }) => {
    await page.goto("/admin/promo-codes/new");
    await page.getByRole("textbox", { name: "Code", exact: true }).fill(code);
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("E2E admin console code");
    await page.getByRole("button", { name: "Create promo code" }).click();

    await expect
      .poll(() => db.queryValue(`SELECT is_active FROM promo_codes WHERE code = '${code}'`))
      .toBe("t");

    await page.goto("/admin/promo-codes");
    await page.getByRole("textbox").first().fill(code);
    const actions = page.getByRole("button", { name: `Actions for ${code}` });
    await expect(actions).toBeVisible();

    await actions.click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect
      .poll(() => db.queryValue(`SELECT is_active FROM promo_codes WHERE code = '${code}'`))
      .toBe("f");

    await actions.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(db.queryValue(`SELECT count(*) FROM promo_codes WHERE code = '${code}'`)).toBe("1");

    await actions.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete code" }).click();
    await expect
      .poll(() => db.queryValue(`SELECT count(*) FROM promo_codes WHERE code = '${code}'`))
      .toBe("0");
  });
});
