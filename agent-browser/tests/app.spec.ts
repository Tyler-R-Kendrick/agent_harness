import { expect, test } from '@playwright/test';

test('captures the main workspace screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await expect(page.getByText('Workspace files')).toBeVisible();
  await page.getByRole('button', { name: 'Add AGENTS.md' }).click();
  await page.getByLabel('Capability name').fill('review-pr');
  await page.getByRole('button', { name: 'Add skill' }).click();
  await expect(page.getByLabel('Workspace file path')).toHaveValue('.agents/skill/review-pr/SKILL.md');
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
  await expect(page.getByText('Workspace plugin manifests')).toBeVisible();
  await expect(page.getByText('No plugin manifests stored yet.')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByText('Recent sessions')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});
