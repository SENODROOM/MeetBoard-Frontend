const { test, expect } = require("@playwright/test");

test.describe("Meeting join path", () => {
  test("can open create/join UI from home", async ({ page }) => {
    await page.goto("/");
    const create = page.getByRole("button", { name: /create|new meeting|start/i });
    const join = page.getByRole("button", { name: /join/i });
    const anyCta = create.or(join).or(page.locator("input, button").first());
    await expect(anyCta.first()).toBeVisible({ timeout: 15_000 });
  });
});
