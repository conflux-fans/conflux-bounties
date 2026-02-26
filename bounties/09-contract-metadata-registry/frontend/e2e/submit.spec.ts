import { test, expect } from '@playwright/test';

test.describe('Submit page', () => {
  test('renders submission form with all fields', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.getByRole('heading', { name: /register contract metadata/i })).toBeVisible();

    await expect(page.getByLabel(/contract address/i)).toBeVisible();
    await expect(page.getByLabel(/project name/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/website/i)).toBeVisible();
    await expect(page.getByLabel(/tags/i)).toBeVisible();
    await expect(page.getByLabel(/abi/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /submit metadata/i })).toBeVisible();
  });

  test('form validates required fields - contract address', async ({ page }) => {
    await page.goto('/submit');
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByLabel(/abi \(json\)/i).fill('[{"type":"function","name":"foo"}]');
    await page.getByRole('button', { name: /submit metadata/i }).click();
    await expect(page).toHaveURL(/\/submit/);
    const addressInput = page.getByLabel(/contract address/i);
    await expect(addressInput).toBeVisible();
  });

  test('form validates required fields - project name', async ({ page }) => {
    await page.goto('/submit');
    await page.getByLabel(/contract address/i).fill('0x1234567890123456789012345678901234567890');
    await page.getByLabel(/abi \(json\)/i).fill('[{"type":"function","name":"foo"}]');
    await page.getByRole('button', { name: /submit metadata/i }).click();

    await expect(page).toHaveURL(/\/submit/);
    await expect(page.getByLabel(/project name/i)).toBeVisible();
  });

  test('form validates required ABI field', async ({ page }) => {
    await page.goto('/submit');
    const abiTextarea = page.getByLabel(/abi \(json\)/i);
    await expect(abiTextarea).toHaveAttribute('required', '');
  });

  test('accepts optional fields: website, tags, logo', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.getByLabel(/website/i)).toBeVisible();
    await expect(page.getByLabel(/tags/i)).toBeVisible();
    await expect(page.getByText(/logo/i)).toBeVisible();
  });

  test('update mode pre-fills contract address from query param', async ({ page }) => {
    const addr = '0x1234567890123456789012345678901234567890';
    await page.goto(`/submit?update=${encodeURIComponent(addr)}`);
    const addressInput = page.getByLabel(/contract address/i);
    await expect(addressInput).toHaveValue(addr);
    await expect(addressInput).toHaveAttribute('readonly');
    await expect(page.getByText(/update mode/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /update metadata/i })).toBeVisible();
  });

  test('file input accepts image types', async ({ page }) => {
    await page.goto('/submit');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', /image\/png|image\/jpeg|image\/svg\+xml/);
  });

  test('submission flow: requires wallet when form is valid', async ({ page }) => {
    await page.goto('/submit');
    await page.getByLabel(/contract address/i).fill('0x1234567890123456789012345678901234567890');
    await page.getByLabel(/project name/i).fill('E2E Test Project');
    await page.getByLabel(/description/i).fill('Description for e2e test');
    await page.getByLabel(/abi \(json\)/i).fill('[{"type":"function","name":"transfer","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]}]');
    await page.getByRole('button', { name: /submit metadata/i }).click();
    await expect(page.getByText(/connect wallet first/i)).toBeVisible();
  });

});
