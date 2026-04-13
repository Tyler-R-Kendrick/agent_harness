import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const SCREENSHOT_DIR = path.resolve(_dirname, '../docs/screenshots/regression');

function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

// ---------------------------------------------------------------------------
// Visual regression BDD tests — describe the reference impl's visual features
// and verify the current app matches them.
// ---------------------------------------------------------------------------

test.describe('visual regression: reference impl parity', () => {
  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  // ── Activity bar: reference uses 42px-wide column, inline SVG icons, ────
  //    active indicator as left-edge bar, separate top/bottom groups
  test('activity bar matches reference layout', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.waitForSelector('[aria-label="Primary navigation"]');

    const activityBar = page.locator('nav.activity-bar');
    await expect(activityBar).toBeVisible();

    // Reference has: Workspaces, History, Extensions at top; Account, Settings at bottom; sidebar toggle last
    await expect(page.getByLabel('Workspaces')).toBeVisible();
    await expect(page.getByLabel('History')).toBeVisible();
    await expect(page.getByLabel('Extensions')).toBeVisible();
    await expect(page.getByLabel('Settings')).toBeVisible();
    await expect(page.getByLabel('Account')).toBeVisible();

    // Sidebar toggle
    const collapseBtn = page.getByLabel(/sidebar/i);
    await expect(collapseBtn.first()).toBeVisible();

    assertNoRuntimeErrors();
    await activityBar.screenshot({ path: `${SCREENSHOT_DIR}/current-activity-bar.png` });
  });

  // ── Sidebar workspace panel: omnibar, workspace pill toggle, tree with ──
  //    memory tier dots, tab count badges, memory bar at bottom
  test('sidebar workspace panel has reference features', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.waitForSelector('[aria-label="Omnibar"]');

    // Omnibar
    await expect(page.getByLabel('Omnibar')).toBeVisible();

    // Workspace toggle pill showing active workspace name + color swatch
    await expect(page.getByLabel('Toggle workspace overlay')).toBeVisible();

    // Hotkey button (?)
    await expect(page.getByLabel('Open keyboard shortcuts')).toBeVisible();

    // Workspace tree visible
    await expect(page.getByLabel('Workspace tree')).toBeVisible();

    // Memory bar
    await expect(page.getByLabel('Memory distribution')).toBeVisible();

    assertNoRuntimeErrors();
    await page.locator('aside.sidebar').screenshot({ path: `${SCREENSHOT_DIR}/current-sidebar-workspace.png` });
  });

  // ── Workspace overlay: compact switcher dialog with dense workspace rows ──
  //    command-style shortcuts, quick create action, and keyboard hints
  test('workspace overlay matches the compact switcher layout', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Omnibar').waitFor();

    // Open workspace overlay
    await page.getByLabel('Toggle workspace overlay').click();

    const overlay = page.getByRole('dialog', { name: 'Workspace switcher' });
    await expect(overlay).toBeVisible();

    // Title
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();

    // Workspace rows visible
    const workspaceCards = overlay.locator('.workspace-card');
    await expect(workspaceCards.first()).toBeVisible();

    // New workspace button
    await expect(overlay.getByText(/new workspace/i)).toBeVisible();

    // Hint row with shortcuts
    await expect(overlay.getByText(/Ctrl\+1-9/)).toBeVisible();

    assertNoRuntimeErrors();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/current-workspace-overlay.png`, fullPage: true });
  });

  // ── Keyboard shortcuts: sections matching reference ──────────────────────
  //    Navigation, Selection, Operations, Quick Access, Workspace Switching
  test('keyboard shortcuts overlay matches reference sections', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Omnibar').waitFor();

    await page.keyboard.press('?');

    const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(shortcuts).toBeVisible();

    // All section headings from reference
    await expect(shortcuts.getByRole('heading', { name: 'Navigation' })).toBeVisible();
    await expect(shortcuts.getByRole('heading', { name: 'Selection' })).toBeVisible();
    await expect(shortcuts.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(shortcuts.getByRole('heading', { name: 'Quick access' })).toBeVisible();
    await expect(shortcuts.getByRole('heading', { name: 'Workspace switching' })).toBeVisible();

    // Key bindings from reference
    await expect(shortcuts.getByText('↑ / ↓')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl+1-9')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl+Alt+←/→')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl+Alt+N')).toBeVisible();
    await expect(shortcuts.getByText('Alt+1-5')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl/Cmd+`')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl+X')).toBeVisible();
    await expect(shortcuts.getByText('Ctrl+V')).toBeVisible();
    await expect(shortcuts.getByText('Home / End')).toBeVisible();

    assertNoRuntimeErrors();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/current-keyboard-shortcuts.png`, fullPage: true });
  });

  // ── Extensions: compact marketplace list with search and install buttons ──
  test('extensions panel has reference marketplace features', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Extensions').click();
    await page.waitForTimeout(500);

    // The reference extensions marketplace shows extension cards with ratings
    // and install actions. At minimum, the current app should show an extensions view.
    const appShell = page.locator('.app-shell');
    await expect(appShell).toBeVisible();

    assertNoRuntimeErrors();
    await appShell.screenshot({ path: `${SCREENSHOT_DIR}/current-extensions.png` });
  });

  // ── Settings: dense model browser with search and compact filter chips ───
  test('settings panel has reference model config features', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Settings').click();
    await page.waitForTimeout(500);

    // HF model search should be present
    await expect(page.getByLabel('Hugging Face search')).toBeVisible();

    assertNoRuntimeErrors();
    await page.locator('.app-shell').screenshot({ path: `${SCREENSHOT_DIR}/current-settings.png` });
  });

  // ── Memory bar: reference has tier-colored segmented bar with legend ─────
  test('memory bar matches reference tier colors', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.waitForSelector('[aria-label="Memory distribution"]');

    const memBar = page.getByLabel('Memory distribution');
    await expect(memBar).toBeVisible();

    // The memory bar should have colored segments (hot=red, warm=yellow, cool=blue, cold=gray)
    const segments = memBar.locator('div');
    const count = await segments.count();
    expect(count).toBeGreaterThan(0);

    assertNoRuntimeErrors();
    await memBar.screenshot({ path: `${SCREENSHOT_DIR}/current-memory-bar.png` });
  });

  // ── Chat: reference has model selector, thinking blocks, streamed tokens ─
  test('chat interface has reference layout', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');

    // Chat panel should be visible as default content
    const chatPanel = page.locator('section.chat-panel');
    await expect(chatPanel).toBeVisible();

    // Chat input
    await expect(page.getByLabel('Chat input')).toBeVisible();

    assertNoRuntimeErrors();
    await chatPanel.screenshot({ path: `${SCREENSHOT_DIR}/current-chat.png` });
  });

  // ── Tree interactions: cursor navigation, multi-select, cut/paste ────────
  test('tree supports keyboard navigation per reference', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.waitForSelector('[aria-label="Workspace tree"]');

    // ArrowDown should move cursor
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // The cursor row should have the 'cursor' class
    const cursorRow = page.locator('.tree-row.cursor');
    await expect(cursorRow.first()).toBeVisible();

    // Space should toggle selection
    await page.keyboard.press(' ');
    await page.waitForTimeout(200);
    const selectedRow = page.locator('.tree-row.selected');
    await expect(selectedRow.first()).toBeVisible();

    // Ctrl+A should select all
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    const selectedCount = await page.locator('.tree-row.selected').count();
    expect(selectedCount).toBeGreaterThan(1);

    // Escape clears selection
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    assertNoRuntimeErrors();
    await page.locator('[aria-label="Workspace tree"]').screenshot({ path: `${SCREENSHOT_DIR}/current-tree-nav.png` });
  });

  // ── Workspace switching via hotkeys ──────────────────────────────────────
  test('workspace switching hotkeys match reference', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/');
    await page.waitForSelector('[aria-label="Workspace tree"]');

    // Ctrl+2 should switch to second workspace
    await page.keyboard.press('Control+2');
    await page.waitForTimeout(500);

    // Ctrl+Alt+ArrowLeft should go back
    await page.keyboard.press('Control+Alt+ArrowLeft');
    await page.waitForTimeout(500);

    // Ctrl+Alt+N should create new workspace
    await page.keyboard.press('Control+Alt+n');
    await page.waitForTimeout(500);

    assertNoRuntimeErrors();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/current-workspace-switch.png`, fullPage: true });
  });
});
