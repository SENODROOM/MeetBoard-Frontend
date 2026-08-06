const { test, expect } = require("@playwright/test");

test.describe("QuantumMeet smoke", () => {
  test("home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("home shows product chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/Quantum|Meet|Join|Create/i);
  });
});
