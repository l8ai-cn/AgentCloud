import { test, expect } from "../../fixtures/index";
import { TEST_ORG_SLUG } from "../../helpers/env";
import { uniqueSuffix } from "../../helpers/test-data";

const nodeId = `e2e-admin-runner-${uniqueSuffix()}`;

test.describe("System administration · runner lifecycle", () => {
  test.beforeEach(async ({ db }) => {
    db.setup(`
      INSERT INTO runners (organization_id, cluster_id, node_id, description, status, is_enabled, created_at, updated_at)
      VALUES (
        (SELECT id FROM organizations WHERE slug = '${TEST_ORG_SLUG}'),
        (SELECT id FROM execution_clusters ORDER BY id LIMIT 1),
        '${nodeId}', 'admin console e2e', 'offline', true, NOW(), NOW()
      )
    `);
  });

  test.afterEach(async ({ db }) => {
    try {
      db.cleanup(`DELETE FROM runners WHERE node_id = '${nodeId}'`);
    } catch {
      // Removed through the UI in the happy path.
    }
  });

  test("disables, re-enables, and deletes a runner behind confirmation", async ({
    page,
    db,
  }) => {
    const enabled = () =>
      db.queryValue(`SELECT is_enabled FROM runners WHERE node_id = '${nodeId}'`);

    await page.goto("/admin/runners");
    await page.getByRole("textbox").first().fill(nodeId);
    await expect(page.getByText(nodeId)).toBeVisible();

    await page.getByRole("button", { name: `Disable ${nodeId}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    expect(enabled()).toBe("t");

    await page.getByRole("button", { name: `Disable ${nodeId}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect.poll(enabled).toBe("f");

    await page.getByRole("button", { name: `Enable ${nodeId}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect.poll(enabled).toBe("t");

    await page.getByRole("button", { name: `Delete ${nodeId}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect
      .poll(() => db.queryValue(`SELECT count(*) FROM runners WHERE node_id = '${nodeId}'`))
      .toBe("0");
  });
});
