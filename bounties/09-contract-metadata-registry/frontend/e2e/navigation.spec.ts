import { test, expect } from '@playwright/test';

test.describe('Full navigation flow', () => {
  test('complete user journey: home -> explore -> contract -> back', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /verified metadata/i })).toBeVisible();

    await page.getByRole('link', { name: /explore contracts/i }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator('a[href*="/contract/"]').first()).toBeVisible({ timeout: 15000 });

    await page.locator('a[href*="/contract/"]').first().click();
    await expect(page).toHaveURL(/\/contract\/0x/);
    await expect(page.getByRole('heading', { name: /sample dex|not found/i })).toBeVisible();

    await page.getByRole('link', { name: /back to explore|explore contracts/i }).first().click();
    await expect(page).toHaveURL(/\/explore/);
  });

  test('header nav: all links work', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /^home$/i }).first().click();
    await expect(page).toHaveURL(/\//);

    await page.getByRole('link', { name: /^submit$/i }).first().click();
    await expect(page).toHaveURL(/\/submit/);

    await page.getByRole('link', { name: /^explore$/i }).first().click();
    await expect(page).toHaveURL(/\/explore/);

    await page.getByRole('link', { name: /^admin$/i }).first().click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('home feature cards navigate correctly', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /go to submit/i }).click();
    await expect(page).toHaveURL(/\/submit/);

    await page.goto('/');
    await page.getByRole('link', { name: /open explorer/i }).click();
    await expect(page).toHaveURL(/\/explore/);

    await page.goto('/');
    await page.getByRole('link', { name: /moderator dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('brand logo links to home', async ({ page }) => {
    await page.goto('/explore');
    await page.getByRole('link', { name: /conflux/i }).first().click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });
});
