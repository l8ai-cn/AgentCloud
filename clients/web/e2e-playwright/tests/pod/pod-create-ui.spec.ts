import { expect, test } from "../../fixtures/index";
import { TEST_ORG_SLUG } from "../../helpers/env";

test.describe("Create Worker UI", () => {
  test("shows AI quick creation and validates a missing prompt", async ({ page }) => {
    await page.goto(`/${TEST_ORG_SLUG}/workers/new`);

    await expect(page.getByRole("heading", {
      name: /Create a Worker in one sentence|用一句话创建 Worker/i,
    })).toBeVisible();

    const createButton = page.getByTestId("worker-ai-create");
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled({ timeout: 30_000 });
    await createButton.click();
    await expect(page.getByText(
      /Describe the Worker before creating it|请先描述要创建的 Worker/i,
    )).toBeVisible();
  });
});
