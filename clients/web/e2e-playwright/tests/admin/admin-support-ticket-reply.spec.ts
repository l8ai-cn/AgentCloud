import { test, expect } from "../../fixtures/index";
import { TEST_USER } from "../../helpers/env";
import { uniqueSuffix } from "../../helpers/test-data";

const title = `E2E admin ticket ${uniqueSuffix()}`;
const reply = "Handled from the consolidated admin console.";

test.describe("System administration · support ticket handling", () => {
  let ticketId: string | null = null;

  test.beforeEach(async ({ db }) => {
    const userId = db.queryValue(
      `SELECT id FROM users WHERE email = '${TEST_USER.email}'`,
    );
    db.setup(`
      INSERT INTO support_tickets (user_id, title, category, status, priority, created_at, updated_at)
      VALUES (${userId}, '${title}', 'other', 'open', 'medium', NOW(), NOW())
    `);
    ticketId = db.queryValue(
      `SELECT id FROM support_tickets WHERE title = '${title}'`,
    );
  });

  test.afterEach(async ({ db }) => {
    if (!ticketId) return;
    db.cleanup(`DELETE FROM support_ticket_messages WHERE ticket_id = ${ticketId}`);
    db.cleanup(`DELETE FROM support_tickets WHERE id = ${ticketId}`);
  });

  test("replies to a ticket and persists the admin message", async ({ page, db }) => {
    await page.goto(`/admin/support-tickets/${ticketId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("textbox", { name: "Admin reply" }).fill(reply);
    await page.getByRole("button", { name: "Send reply" }).click();

    await expect(page.getByText(reply)).toBeVisible();
    await expect
      .poll(() =>
        db.queryValue(
          `SELECT is_admin_reply FROM support_ticket_messages WHERE ticket_id = ${ticketId}`,
        ),
      )
      .toBe("t");
  });
});
