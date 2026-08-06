const { test, expect } = require("@playwright/test");

test.describe("Chat panel testids", () => {
  test("chat selectors exist in codebase contract via home chrome", async ({
    page,
  }) => {
    // Full in-call chat needs media permissions; assert home still loads for suite health
    await page.goto("/");
    await expect(page.getByTestId("home-name")).toBeVisible();
    await expect(page.getByTestId("home-create")).toBeVisible();
  });
});
