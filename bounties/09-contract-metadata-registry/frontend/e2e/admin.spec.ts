import { test, expect } from '@playwright/test';

test.describe('Admin page', () => {
  test('renders moderator dashboard heading', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /moderator dashboard/i })).toBeVisible();
    await expect(page.getByText(/review and approve/i)).toBeVisible();
  });

  test('prompts to connect wallet when not connected', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/please connect your wallet/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows connect prompt or submissions content', async ({ page }) => {
    await page.goto('/admin');
    await expect(
      page.getByText(/please connect your wallet|moderator dashboard|no pending submissions/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
