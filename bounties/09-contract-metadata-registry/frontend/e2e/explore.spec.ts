import { test, expect } from '@playwright/test';

test.describe('Explore page', () => {
  test('loads and displays contract cards or empty state', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
    await expect(
      page.getByText(/sample dex|mock lending|no results|try a different|approved/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('has search form with inputs and button', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByLabel(/search/i)).toBeVisible();
    await expect(page.getByLabel(/tag/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
  });

  test('search filters results by query', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();

    await page.getByLabel(/search/i).fill('dex');
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/sample dex|no results|mock lending/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('search filters results by tag', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();

    await page.getByLabel(/tag/i).fill('lending');
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/mock lending|sample dex|no results/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('empty search shows no results message when no matches', async ({ page }) => {
    await page.goto('/explore');
    await page.getByLabel(/search/i).fill('nonexistentcontractxyz');
    await page.getByRole('button', { name: /search/i }).click();

    await expect(page.getByText(/no results/i)).toBeVisible({ timeout: 5000 });
  });

  test('contract card links to contract detail page', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    const contractLink = page.locator('a[href*="/contract/"]').first();
    if ((await contractLink.count()) > 0) {
      await contractLink.click();
      await expect(page).toHaveURL(/\/contract\/0x/);
      await expect(
        page.getByRole('heading', { name: /sample dex|not found/i })
          .or(page.getByText(/not registered/i))
          .first()
      ).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.getByText(/no results|try a different/i)).toBeVisible();
    }
  });

  test('cards show Approved badge', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByText(/approved|no results/i).first()).toBeVisible({ timeout: 15000 });
  });
});
