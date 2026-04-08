import { expect, test } from '@playwright/test';

test('captures the main workspace screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await expect(page.getByText('Workspace storage')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AGENTS.md' })).toBeVisible();
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
  await expect(page.getByText('Extension marketplace')).toBeVisible();
  await expect(page.getByText('Workspace-scoped harness support now lives in Exploration')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByText('Recent sessions')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});
