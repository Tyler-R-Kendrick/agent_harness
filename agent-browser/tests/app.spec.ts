import { expect, test } from '@playwright/test';

test('captures the main workspace screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/workspace-screen.png', fullPage: true });
});

test('captures the settings screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByLabel('Hugging Face search')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/settings-screen.png', fullPage: true });
});

test('captures the extensions screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Extensions').click();
  await expect(page.getByText('Agent harness support')).toBeVisible();
  await expect(page.getByText('AGENTS.md')).toBeVisible();
  await expect(page.getByText('marketplace.json')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByText('Recent sessions')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});
