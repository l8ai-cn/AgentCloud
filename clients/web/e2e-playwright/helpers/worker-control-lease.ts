import { expect, type Page } from "@playwright/test";

// Overlay CTA is "Unlock" after force-acquire became the only path; keep the
// legacy "Take control" label so older builds still match during rollout.
const CONTROL_BUTTON = /^(unlock|take control)$/i;

export async function takeWorkerControl(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: CONTROL_BUTTON });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await expect(button).toBeHidden({ timeout: 30_000 });
}
