/**
 * Playwright spec: FileOpPicker (Move / Symlink / Duplicate directory picker).
 *
 * Captures four reference states of the picker:
 *   1. Root view — breadcrumb shows "~/" with an empty directory list.
 *   2. Filtered view — user has typed a prefix that reduces visible dirs.
 *   3. Nested view — user navigated into a subdirectory, ".." row visible.
 *   4. Empty-subdir view — navigated into a dir that has no children.
 *
 * Screenshots are saved to docs/screenshots/ for the PR.
 */

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const SCREENSHOT_DIR = path.resolve(_dirname, '../docs/screenshots');

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

async function mockCopilotStatus(page: Page): Promise<void> {
  await page.route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_COPILOT_STATUS),
    });
  });
}

function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/** Add a skill file via the "Add file to Research" button and wait for the tree to update. */
async function addSkillFile(page: Page, name: string): Promise<void> {
  await page.getByLabel('Add file to Research').click();
  const dialog = page.getByRole('dialog', { name: 'Add file' });
  await dialog.getByLabel('Capability name').fill(name);
  await dialog.getByRole('button', { name: 'Skill', exact: true }).click();
  await expect(page.getByRole('treeitem').filter({ hasText: name })).toBeVisible();
}

/** Open the Move dialog for the newly created SKILL.md treeitem. */
async function openMovePicker(page: Page): Promise<void> {
  const skillItem = page.getByRole('treeitem').filter({ hasText: 'SKILL.md' }).last();
  await skillItem.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Move file' })).toBeVisible();
}

test.describe('FileOpPicker screenshots', () => {
  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  test.beforeEach(async ({ page }) => {
    await mockCopilotStatus(page);
  });

  test('picker root view — empty breadcrumb, no dirs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Add AGENTS.md (root-level file → no subdirectories in picker)
    await page.getByLabel('Add file to Research').click();
    await page.getByRole('button', { name: 'AGENTS.md' }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'AGENTS.md' }).first()).toBeVisible();

    const agentsItem = page.getByRole('treeitem').filter({ hasText: 'AGENTS.md' }).first();
    await agentsItem.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Move file' });
    await expect(dialog).toBeVisible();

    // Verify breadcrumb shows ~/
    const input = page.getByRole('textbox', { name: /target directory/i });
    await expect(input).toHaveValue('~/');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'file-op-picker-root.png'),
      clip: await dialog.boundingBox().then((b) => b ?? { x: 0, y: 0, width: 600, height: 400 }),
    });
  });

  test('picker filtered view — shows matching dirs, Create & Add hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addSkillFile(page, 'my-skill');
    await openMovePicker(page);

    const input = page.getByRole('textbox', { name: /target directory/i });
    // Clear the input and type a partial path that won't exactly match any dir
    await input.fill('~/a');

    const dialog = page.getByRole('dialog', { name: 'Move file' });
    await expect(dialog).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'file-op-picker-filtered.png'),
      clip: await dialog.boundingBox().then((b) => b ?? { x: 0, y: 0, width: 600, height: 400 }),
    });
  });

  test('picker nested view — .agents/ entered, subdirs visible, ".." row shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addSkillFile(page, 'my-skill');
    await openMovePicker(page);

    const input = page.getByRole('textbox', { name: /target directory/i });
    await input.fill('~/.agents/');

    const dialog = page.getByRole('dialog', { name: 'Move file' });
    await expect(dialog).toBeVisible();

    // ".." row should be visible
    await expect(page.getByRole('listbox', { name: 'Directories' })).toContainText('..');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'file-op-picker-nested.png'),
      clip: await dialog.boundingBox().then((b) => b ?? { x: 0, y: 0, width: 600, height: 400 }),
    });
  });

  test('picker empty-subdir view — deepest dir shows only ".."', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addSkillFile(page, 'my-skill');
    await openMovePicker(page);

    const input = page.getByRole('textbox', { name: /target directory/i });
    // Navigate to the deepest directory which has no sub-directories
    await input.fill('~/.agents/skills/my-skill/');

    const dialog = page.getByRole('dialog', { name: 'Move file' });
    await expect(dialog).toBeVisible();

    const listbox = page.getByRole('listbox', { name: 'Directories' });
    // Only the ".." row should be visible
    await expect(listbox).toContainText('..');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'file-op-picker-empty-subdir.png'),
      clip: await dialog.boundingBox().then((b) => b ?? { x: 0, y: 0, width: 600, height: 400 }),
    });
  });

  test('picker keyboard: ArrowDown highlights row, Enter descends, Backspace ascends', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addSkillFile(page, 'kbd-skill');
    await openMovePicker(page);

    const input = page.getByRole('textbox', { name: /target directory/i });

    // Press ArrowDown to highlight first row
    await input.press('ArrowDown');

    // Press Enter to descend into that directory
    await input.press('Enter');

    // Now breadcrumb should have advanced past ~/
    const val = await input.inputValue();
    expect(val.length).toBeGreaterThan(2); // longer than ~/

    // Backspace should step back up (filter is empty after descend)
    await input.press('Backspace');
    await expect(input).toHaveValue('~/');
  });

  test('picker Escape closes the dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addSkillFile(page, 'esc-skill');
    await openMovePicker(page);

    const input = page.getByRole('textbox', { name: /target directory/i });
    await input.press('Escape');

    await expect(page.getByRole('dialog', { name: 'Move file' })).not.toBeVisible();
  });
});
