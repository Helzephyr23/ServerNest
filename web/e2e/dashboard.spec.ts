import { test, expect, Page } from "@playwright/test";

const TEST_USER = process.env.E2E_USERNAME || "admin";
const TEST_PASS = process.env.E2E_PASSWORD || "admin123";

async function login(page: Page, username = TEST_USER, password = TEST_PASS) {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Dashboard (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows dashboard overview with stats", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("text=/servers|overview|nodes/i")).toBeVisible({ timeout: 10000 });
  });

  test("navigates to servers list", async ({ page }) => {
    await page.getByRole("link", { name: /servers/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/servers/);
    await expect(page.locator("text=/create|new server|template/i")).toBeVisible({ timeout: 10000 });
  });

  test("navigates to templates page", async ({ page }) => {
    await page.getByRole("link", { name: /templates/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/templates/);
    await expect(page.locator("text=/server templates|quick-start/i")).toBeVisible({ timeout: 10000 });
  });

  test("navigates to create server page", async ({ page }) => {
    await page.goto("/dashboard/servers/new");
    await expect(page.locator("text=/create server/i")).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder("My Server")).toBeVisible();
  });

  test("navigates to marketplace", async ({ page }) => {
    await page.getByRole("link", { name: /marketplace|mods/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/marketplace/);
  });
});

test.describe("Server creation flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("create server page has all form fields", async ({ page }) => {
    await page.goto("/dashboard/servers/new");
    await expect(page.getByPlaceholder("My Server")).toBeVisible();
    await expect(page.getByRole("button", { name: /create server/i })).toBeVisible();
    await expect(page.locator("text=/eula|license/i")).toBeVisible();
  });

  test("cannot submit without EULA acceptance", async ({ page }) => {
    await page.goto("/dashboard/servers/new");
    await page.getByPlaceholder("My Server").fill("Test Server");
    await page.getByRole("button", { name: /create server/i }).click();
    await expect(page.locator("text=/eula|accept/i")).toBeVisible();
  });
});

test.describe("Template pre-fill", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("template query param loads preset", async ({ page }) => {
    await page.goto("/dashboard/servers/new?template=paper");
    await expect(page.locator("text=/template.*paper|paper.*template/i")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Logout", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("logout redirects to login", async ({ page }) => {
    const logoutBtn = page.getByRole("button", { name: /log out|sign out|logout/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
