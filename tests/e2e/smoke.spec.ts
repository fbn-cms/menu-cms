import { expect, test } from "@playwright/test";

test("home renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBe(true);
  await expect(page.locator("h1")).toBeVisible();
});
