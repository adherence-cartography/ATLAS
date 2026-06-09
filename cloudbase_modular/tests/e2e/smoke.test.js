import { test, expect } from '@playwright/test';

test('entry screen loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ATLAS/);
  await expect(page.locator('#screen-entry')).toBeVisible();
});

test('assess route loads assessment screen', async ({ page }) => {
  await page.goto('/assess');
  await expect(page).toHaveTitle(/MMAS-8/);
});

test('theme toggle switches theme', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await page.click('#theme-toggle-float');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.click('#theme-toggle-float');
  await expect(html).not.toHaveAttribute('data-theme', 'light');
});

test('mobile: entry screen fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  await page.goto('/');
  const entry = page.locator('#screen-entry');
  await expect(entry).toBeVisible();
  // Check no horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
});
