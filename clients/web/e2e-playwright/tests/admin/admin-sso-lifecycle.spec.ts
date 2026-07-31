import { test, expect } from "../../fixtures/index";
import { uniqueSuffix } from "../../helpers/test-data";

const suffix = uniqueSuffix();
const domain = `e2e-admin-sso-${suffix}.example.com`;
const name = `E2E Admin LDAP ${suffix}`;

const seedSql = `
  INSERT INTO sso_configs (domain, name, protocol, is_enabled, ldap_host, ldap_port, ldap_base_dn, created_at, updated_at)
  VALUES ('${domain}', '${name}', 'ldap', false, 'ldap.example.com', 389, 'dc=example,dc=com', NOW(), NOW())
`.trim();

test.describe("System administration · SSO configuration lifecycle", () => {
  test.beforeEach(async ({ db }) => {
    db.setup(seedSql);
  });

  test.afterEach(async ({ db }) => {
    try {
      db.cleanup(`DELETE FROM sso_configs WHERE domain = '${domain}'`);
    } catch {
      // Deleted through the UI in the happy path.
    }
  });

  test("enables then deletes a configuration only after confirmation", async ({
    page,
    db,
  }) => {
    await page.goto("/admin/sso");
    await expect(page.getByText(domain)).toBeVisible();

    await page.getByRole("button", { name: `Enable ${name}` }).click();
    await page.getByRole("button", { name: "Enable", exact: true }).click();
    await expect
      .poll(() => db.queryValue(`SELECT is_enabled FROM sso_configs WHERE domain = '${domain}'`))
      .toBe("t");

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(
      db.queryValue(`SELECT count(*) FROM sso_configs WHERE domain = '${domain}'`),
    ).toBe("1");

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect
      .poll(() =>
        db.queryValue(`SELECT count(*) FROM sso_configs WHERE domain = '${domain}'`),
      )
      .toBe("0");
    await expect(page.getByText(domain)).toHaveCount(0);
  });
});
