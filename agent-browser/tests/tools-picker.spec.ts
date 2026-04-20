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
  await expect(page.getByRole('checkbox', { name: 'CLI', exact: true })).toBeChecked();

  await page.screenshot({ path: 'docs/screenshots/tools-picker-open.png', fullPage: false });
});

// Verifies that all built-in tools, including WebMCP-backed tools, are shown in one built-in
// bucket with surface-specific sub-groups (Browser, Sessions, Files, etc.) underneath.
// REGRESSION: must not show a separate top-level "WebMCP" group — all tools belong in Built-In.
test('Tools picker: shows one built-in bucket with surface sub-groups selected by default', async ({ page }) => {
  await mockCopilotStatus(page);
  // Tall viewport so all sub-groups are visible without scrolling
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Tools picker' });
  await expect(dialog).toBeVisible();

  // Top-level Built-In bucket — must contain ALL tools, count must be > 1 (not just CLI)
  await expect(dialog.getByText('Built-In')).toBeVisible();
  await expect(dialog.getByText('38/38')).toBeVisible();
  const builtInToggle = page.getByRole('checkbox', { name: 'Toggle all Built-In tools' });
  await expect(builtInToggle).toBeVisible();
  await expect(builtInToggle).toBeChecked();

  // REGRESSION CHECK: there must be NO separate top-level "WebMCP" group.
  // All WebMCP tools belong inside the Built-In bucket as sub-groups.
  await expect(page.getByRole('checkbox', { name: 'Toggle all WebMCP tools' })).not.toBeAttached();
  // The word "WebMCP" must NOT appear as a group header label in the dialog
  await expect(dialog.locator('.tools-picker-group-label', { hasText: 'WebMCP' })).not.toBeAttached();

  // CLI is ungrouped — appears flat under Built-In (not inside any sub-group)
  await expect(page.getByRole('checkbox', { name: 'CLI', exact: true })).toBeChecked();

  // All 6 surface sub-group headers must be visible AND checked inside the Built-In bucket
  const subGroups = ['Browser', 'Sessions', 'Files', 'Clipboard', 'Renderer', 'Workspace'];
  for (const subGroupLabel of subGroups) {
    const toggle = dialog.getByRole('checkbox', { name: `Toggle all ${subGroupLabel} tools` });
    await expect(toggle, `Sub-group "${subGroupLabel}" must be visible inside Built-In`).toBeVisible();
    await expect(toggle).toBeChecked();
  }

  // Representative individual tool checkboxes inside sub-groups must be visible and checked
  await expect(page.getByRole('checkbox', { name: 'List filesystem entries', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Submit session message', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Restore clipboard entry', exact: true })).toBeChecked();

  // Screenshot showing the full sub-group structure inside Built-In
  await page.screenshot({ path: 'docs/screenshots/tools-picker-built-in-bucket.png', fullPage: false });

  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(trigger).toHaveAttribute('aria-label', /\d+ of \d+ selected/);
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

// Regression: clicking a group header row must only expand/collapse — never toggle the checkbox.
test('Tools picker: clicking group header row expands/collapses without toggling checkbox', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Tools picker' });
  await expect(dialog).toBeVisible();

  // Find a collapsible sub-group header (e.g. Workspace)
  const subGroupHeader = dialog.locator('.tools-picker-group-header[role="button"]', { hasText: 'Workspace' });
  await expect(subGroupHeader).toBeVisible();
  const checkbox = subGroupHeader.locator('input[type="checkbox"]');

  // Initially expanded
  await expect(subGroupHeader).toHaveAttribute('aria-expanded', 'true');
  const checkedBefore = await checkbox.isChecked();

  // Click the header row (not the checkbox) — should collapse, not toggle checkbox
  await subGroupHeader.click();
  await expect(subGroupHeader).toHaveAttribute('aria-expanded', 'false');

  // Checkbox state must not have changed
  expect(await checkbox.isChecked()).toBe(checkedBefore);

  // Screenshot: collapsed state
  await page.screenshot({ path: 'docs/screenshots/tools-picker-group-collapsed.png', fullPage: false });

  // Click again to re-expand
  await subGroupHeader.click();
  await expect(subGroupHeader).toHaveAttribute('aria-expanded', 'true');

  // Checkbox state still unchanged
  expect(await checkbox.isChecked()).toBe(checkedBefore);

  // Screenshot: expanded state again
  await page.screenshot({ path: 'docs/screenshots/tools-picker-group-expanded.png', fullPage: false });
});
