import { expect, test } from '@playwright/test';

test('captures the main workspace screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.screenshot({ path: 'test-results/workspace-screen.png', fullPage: true });
});

test('captures the settings screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByText('Browser model registry')).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-screen.png', fullPage: true });
});

test('captures the extensions screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Extensions').click();
  await expect(page.getByText('Extensions')).toBeVisible();
  await page.screenshot({ path: 'test-results/extensions-screen.png', fullPage: true });
});
