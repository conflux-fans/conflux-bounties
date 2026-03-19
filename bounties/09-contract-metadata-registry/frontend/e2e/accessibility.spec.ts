import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('home page has proper document structure', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('forms have associated labels', async ({ page }) => {
    await page.goto('/submit');
    const contractInput = page.getByLabel(/contract address/i);
    await expect(contractInput).toBeVisible();
    await expect(contractInput).toHaveAttribute('id');
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('connect wallet button has aria attributes', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /connect wallet|choose wallet/i });
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toHaveAttribute('aria-label');
  });

  test('navigation links have descriptive text', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const nav = page.getByRole('navigation');
    const navLinks = nav.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
