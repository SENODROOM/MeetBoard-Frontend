const { test, expect } = require("@playwright/test");

test.describe("Meeting create path", () => {
  test("create meeting reaches ready state", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.getByTestId("home-name").fill("E2E Host");
    await page.getByTestId("home-create").click();
    await expect(page.getByTestId("home-created")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("home-enter-room")).toBeVisible();
  });
});
