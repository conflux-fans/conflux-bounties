import { test, expect } from '@playwright/test';

const SAMPLE_CONTRACT = '0x1234567890123456789012345678901234567890';
const UNKNOWN_CONTRACT = '0x0000000000000000000000000000000000000001';

test.describe('Contract detail page', () => {
  test('displays full metadata or not found for known contract', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(
      page.getByRole('heading', { name: /sample dex|not found/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(SAMPLE_CONTRACT).or(page.getByText(/not registered/i))).toBeVisible();
  });

  test('shows metadata details or not found', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(
      page.getByText(/approved|version 1|sample decentralized|not registered|not found/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('has link back to explore', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    const backLink = page.getByRole('link', { name: /back to explore|explore contracts/i });
    await expect(backLink.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows ABI viewer or not found', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(
      page.getByText(/abi viewer|balanceOf|transfer|not found|not registered/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('has download links or explore link', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(
      page.getByRole('link', { name: /download metadata|download abi|explore contracts/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows proof: CID and checksum for registered contract', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(page.getByText(/QmSampleCid|0x[a-fA-F0-9]{64}/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/CID|Checksum/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /download metadata json/i })).toBeVisible();
  });

  test('shows version history when available', async ({ page }) => {
    await page.goto(`/contract/${SAMPLE_CONTRACT}`);
    await expect(page.getByRole('heading', { name: /version history/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/v1|v2/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /view on ipfs/i })).toBeVisible();
  });

  test('shows Not found for unknown contract', async ({ page }) => {
    await page.goto(`/contract/${UNKNOWN_CONTRACT}`);
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/not registered or not verified/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /explore contracts/i })).toBeVisible();
  });

  test('invalid address format is handled', async ({ page }) => {
    await page.goto('/contract/invalid');
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });
});
