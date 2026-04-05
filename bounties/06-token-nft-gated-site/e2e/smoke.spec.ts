import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
});

test("protected API returns 401 without session", async ({ request }) => {
  const res = await request.get("/api/protected/ping");
  expect(res.status()).toBe(401);
});
