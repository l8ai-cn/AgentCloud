import { test, expect } from "../../fixtures/index";
import { uniqueSuffix } from "../../helpers/test-data";

const suffix = uniqueSuffix();
const orgName = `E2E Admin Billing ${suffix}`;
const orgSlug = `e2e-admin-billing-${suffix}`.replace(/[^a-z0-9-]/g, "-");

test.describe("System administration · subscription lifecycle", () => {
  let orgId: string | null = null;

  test.beforeEach(async ({ db }) => {
    db.setup(`
      INSERT INTO organizations (name, slug, subscription_plan, subscription_status, created_at, updated_at)
      VALUES ('${orgName}', '${orgSlug}', 'pro', 'active', NOW(), NOW())
    `);
    orgId = db.queryValue(`SELECT id FROM organizations WHERE slug = '${orgSlug}'`);
    db.setup(`
      INSERT INTO subscriptions (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, seat_count, created_at, updated_at)
      VALUES (${orgId}, (SELECT id FROM subscription_plans ORDER BY id LIMIT 1), 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days', 1, NOW(), NOW())
    `);
  });

  test.afterEach(async ({ db }) => {
    if (!orgId) return;
    db.cleanup(`DELETE FROM subscriptions WHERE organization_id = ${orgId}`);
    db.cleanup(`DELETE FROM organizations WHERE id = ${orgId}`);
  });

  test("freezes and unfreezes only after confirmation", async ({ page, db }) => {
    const status = () =>
      db.queryValue(`SELECT status FROM subscriptions WHERE organization_id = ${orgId}`);

    await page.goto(`/admin/organizations/${orgId}`);
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible();

    await page.getByRole("button", { name: "Freeze" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(status()).toBe("active");

    await page.getByRole("button", { name: "Freeze" }).click();
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect.poll(status).toBe("frozen");

    await page.getByRole("button", { name: "Unfreeze" }).click();
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect.poll(status).toBe("active");
  });
});
