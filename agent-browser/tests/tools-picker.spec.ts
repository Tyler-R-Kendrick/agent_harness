import { expect, test, type Page } from '@playwright/test';

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: true,
  login: 'octocat',
  models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

async function mockCopilotStatus(page: Page) {
  await page.context().route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_COPILOT_STATUS),
    });
  });
}

test('Tools picker: header trigger and open popover', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.goto('/');

  await expect(page.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await expect(trigger).toBeVisible();

  await page.screenshot({ path: 'docs/screenshots/tools-picker-closed.png', fullPage: false });

  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Tools picker' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'CLI' })).toBeChecked();

  await page.screenshot({ path: 'docs/screenshots/tools-picker-open.png', fullPage: false });
});

// Verifies that both built-in tools (CLI + WebMCP) are present and selected by default.
test('Tools picker: shows two built-in tools (CLI and WebMCP) selected by default', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Tools picker' });
  await expect(dialog).toBeVisible();

  // Both built-in tools must be present and checked
  await expect(page.getByRole('checkbox', { name: 'CLI' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'WebMCP' })).toBeChecked();

  // The count badge on the trigger should show 2
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(trigger).toHaveAttribute('aria-label', /2 of 2/);

  await page.screenshot({ path: 'docs/screenshots/tools-picker-two-builtins.png', fullPage: false });
});

// Regression test: tools picker popover must not be clipped by overflow:hidden ancestors
// or covered by the workspace sidebar overlay at any viewport width.
test('Tools picker: popover is not clipped by the workspace overlay at narrow viewport', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.setViewportSize({ width: 640, height: 768 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const popover = page.getByRole('dialog', { name: 'Tools picker' });
  await expect(popover).toBeVisible();

  // The popover must be fully within the viewport — not clipped by overflow:hidden
  // on content-area, panel-drag-cell, or browser-split-view ancestors.
  const viewport = page.viewportSize()!;
  const box = await popover.boundingBox();

  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

  // The entire popover content must be reachable — no ancestor should clip it.
  // Verify the Done button inside the popover is not clipped.
  const doneButton = popover.getByRole('button', { name: 'Done' });
  await expect(doneButton).toBeVisible();
  const doneBbox = await doneButton.boundingBox();
  expect(doneBbox!.y + doneBbox!.height).toBeLessThanOrEqual(viewport.height);

  await page.screenshot({ path: 'docs/screenshots/tools-picker-narrow-not-clipped.png', fullPage: false });
});
