import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('renders hero section with title and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /verified metadata for/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /conflux contracts/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register metadata/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /explore contracts/i })).toBeVisible();
  });

  test('has three feature cards with correct links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /what you can do/i })).toBeVisible();

    const submitCard = page.getByRole('link', { name: /go to submit/i });
    await expect(submitCard).toBeVisible();
    await expect(submitCard).toHaveAttribute('href', '/submit');

    const exploreCard = page.getByRole('link', { name: /open explorer/i });
    await expect(exploreCard).toBeVisible();
    await expect(exploreCard).toHaveAttribute('href', '/explore');

    const adminCard = page.getByRole('link', { name: /moderator dashboard/i });
    await expect(adminCard).toBeVisible();
    await expect(adminCard).toHaveAttribute('href', '/admin');
  });

  test('has accessible navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /home/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /submit/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /explore/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /admin/i }).first()).toBeVisible();
  });

  test('primary CTA navigates to submit page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /register metadata/i }).click();
    await expect(page).toHaveURL(/\/submit/);
    await expect(page.getByRole('heading', { name: /register contract metadata/i })).toBeVisible();
  });

  test('secondary CTA navigates to explore page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /explore contracts/i }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole('heading', { name: /explore contracts/i })).toBeVisible();
  });
});
