import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("renders login form with username and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });

  test("shows error on invalid login", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Username").fill("wronguser");
    await page.getByPlaceholder("Password").fill("wrongpass");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator("text=/invalid|incorrect|fail/i")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Navigation", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
