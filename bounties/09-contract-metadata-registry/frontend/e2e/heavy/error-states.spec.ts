import { test, expect } from '@playwright/test';

test.describe('Error states and heavy scenarios', () => {
  test('explore: handles empty API response', async ({ page }) => {
    await page.route('**/v1/metadata/**', async (route) => {
      const url = route.request().url();
      const isList = /\/v1\/metadata\/?\??/.test(url) && !/\/v1\/metadata\/0x[a-fA-F0-9]{40}/.test(url);
      if (isList) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/explore');
    await expect(page.getByText(/no results/i)).toBeVisible({ timeout: 10000 });
  });

  test('explore: handles API error gracefully', async ({ page }) => {
    await page.route('**/v1/metadata/**', async (route) => {
      const url = route.request().url();
      const isList = /\/v1\/metadata\/?\??/.test(url) && !/\/v1\/metadata\/0x[a-fA-F0-9]{40}/.test(url);
      if (isList) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal error"}' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/explore');
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
  });

  test('contract: handles 404 from API', async ({ page }) => {
    const unknownAddr = '0x9999999999999999999999999999999999999999';
    await page.goto(`/contract/${unknownAddr}`);
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible({ timeout: 10000 });
  });

  test('submit: connect wallet alert when submitting without wallet', async ({ page }) => {
    await page.goto('/submit');
    await page.getByLabel(/contract address/i).fill('0x1234567890123456789012345678901234567890');
    await page.getByLabel(/project name/i).fill('Test');
    await page.getByLabel(/description/i).fill('Desc');
    await page.getByLabel(/abi \(json\)/i).fill('[{"type":"function","name":"foo"}]');

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Connect wallet');
      dialog.accept();
    });

    await page.getByRole('button', { name: /submit metadata/i }).click();
  });

  test('form: invalid JSON in ABI triggers error on submit', async ({ page }) => {
    await page.goto('/submit');
    await page.getByLabel(/contract address/i).fill('0x1234567890123456789012345678901234567890');
    await page.getByLabel(/project name/i).fill('Test');
    await page.getByLabel(/abi \(json\)/i).fill('not valid json');

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /submit metadata/i }).click();
    await expect(page).toHaveURL(/\/submit/);
  });

  test('page loads with delayed API response', async ({ page }) => {
    await page.route('**/v1/metadata/**', async (route) => {
      const url = route.request().url();
      const isList = /\/v1\/metadata\/?\??/.test(url) && !/\/v1\/metadata\/0x[a-fA-F0-9]{40}/.test(url);
      if (isList) {
        await new Promise((r) => setTimeout(r, 1000));
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
    await expect(page.getByText(/sample dex|no results|try a different|approved/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('multiple viewport sizes: mobile and desktop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /verified metadata/i })).toBeVisible({ timeout: 10000 });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/sample dex|no results|try a different|approved|search approved/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('rapid navigation does not cause race conditions', async ({ page }) => {
    await page.goto('/');
    await page.goto('/explore');
    await page.goto('/submit');
    await page.goto('/admin');
    await page.goto('/explore');

    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/sample dex|no results|try a different|approved|search approved/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
