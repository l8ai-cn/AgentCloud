import { expect, test } from "@playwright/test";

test.describe("System administration UI", () => {
  test("serves migrated admin capabilities from the main Web app", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "System administration" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Organizations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Relays" })).toBeVisible();
    await expect(page.getByRole("link", { name: "SSO" })).toBeVisible();

    await page.goto("/admin/organizations");
    await page.getByRole("link", { name: "Open Dev Organization" }).click();
    const runnerSection = page
      .getByRole("heading", { name: /^Runners \([1-9]\d*\)$/ })
      .locator("xpath=ancestor::section");
    await expect(runnerSection).toBeVisible();
    await expect(runnerSection.locator("details").first()).toBeVisible();

    await page.goto("/admin/relays");
    await page.getByRole("link", { name: /^View .+ details$/ }).first().click();
    await expect(page.getByRole("heading", { name: "Connection" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Capacity and health" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Location" })).toBeVisible();
    await expect(page.getByText(/sessions/i)).toHaveCount(0);
  });

  test("keeps organization administration within a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/organizations/1");

    await expect(page.getByRole("heading", { name: "Dev Organization" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Runners \(/ })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
});
