import { test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = 'docs/screenshots/regression';
const REFERENCE_URL =
  'file:///home/runner/work/agent_harness/agent_harness/reference_impl/workspace-prototype.html';
const CURRENT_URL = 'http://127.0.0.1:4173/';

/** Ensure the screenshot output directory exists. */
function ensureScreenshotDir(): void {
  const absolute = path.resolve(SCREENSHOT_DIR);
  if (!fs.existsSync(absolute)) {
    fs.mkdirSync(absolute, { recursive: true });
  }
}

/** Wait for the reference page's React/Babel CDN bundle to render. */
async function waitForReference(page: Page): Promise<void> {
  // The reference page loads React from CDN and transpiles JSX via Babel.
  // Give it time to boot, then wait for the root container to have children.
  await page.waitForTimeout(3000);
  await page.waitForSelector('#root > *', { timeout: 15000 });
}

/** Wait for the current Vite app to be interactive. */
async function waitForCurrent(page: Page): Promise<void> {
  await page.waitForSelector('[aria-label="Primary navigation"]', {
    timeout: 10000,
  });
}

/** Helper to screenshot an element (or the full page when the selector is absent). */
async function screenshotRegion(
  page: Page,
  selector: string | null,
  filePath: string,
): Promise<void> {
  if (selector) {
    const element = page.locator(selector).first();
    await element.screenshot({ path: filePath });
  } else {
    await page.screenshot({ path: filePath, fullPage: true });
  }
}

// ---------------------------------------------------------------------------
// Visual regression test suite
// ---------------------------------------------------------------------------

test.describe('visual regression', () => {
  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  // ── Test 1: Activity bar comparison ─────────────────────────────────

  test('activity bar comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: the first child div of #root is the flex container;
    // the activity bar is its first child (42px‑wide column).
    await screenshotRegion(
      refPage,
      '#root > div > div:first-child',
      `${SCREENSHOT_DIR}/reference-activity-bar.png`,
    );

    // Current: <nav class="activity-bar">
    await screenshotRegion(
      curPage,
      'nav.activity-bar',
      `${SCREENSHOT_DIR}/current-activity-bar.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 2: Sidebar workspace panel ─────────────────────────────────

  test('sidebar workspace panel comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: sidebar panel is the second child div (260px wide) of the
    // main flex container when the sidebar is open (default).
    await screenshotRegion(
      refPage,
      '#root > div > div:nth-child(2)',
      `${SCREENSHOT_DIR}/reference-sidebar-workspace.png`,
    );

    // Current: <aside class="sidebar"> wrapping the workspace tree
    await screenshotRegion(
      curPage,
      'aside.sidebar',
      `${SCREENSHOT_DIR}/current-sidebar-workspace.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 3: Workspace overlay ───────────────────────────────────────

  test('workspace overlay comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: click the workspace‑switcher button (data‑action="ws-overlay")
    await refPage.click('[data-action="ws-overlay"]');
    await refPage.waitForTimeout(500);

    await screenshotRegion(
      refPage,
      null, // full-page captures the overlay backdrop + cards
      `${SCREENSHOT_DIR}/reference-workspace-overlay.png`,
    );

    // Current: open via the "Toggle workspace overlay" button
    await curPage.getByLabel('Toggle workspace overlay').click();
    await curPage.waitForSelector('[aria-label="Workspace switcher"]', {
      timeout: 5000,
    });

    await screenshotRegion(
      curPage,
      '[aria-label="Workspace switcher"]',
      `${SCREENSHOT_DIR}/current-workspace-overlay.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 4: Keyboard shortcuts overlay ──────────────────────────────

  test('keyboard shortcuts overlay comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: press "?" to toggle the shortcut overlay
    await refPage.keyboard.press('?');
    await refPage.waitForTimeout(500);

    await screenshotRegion(
      refPage,
      null, // full-page overlay
      `${SCREENSHOT_DIR}/reference-keyboard-shortcuts.png`,
    );

    // Current: press "?" to open the shortcuts dialog
    await curPage.getByLabel('Omnibar').waitFor();
    await curPage.keyboard.press('?');
    await curPage.waitForSelector('[aria-label="Keyboard shortcuts"]', {
      timeout: 5000,
    });

    await screenshotRegion(
      curPage,
      '[aria-label="Keyboard shortcuts"]',
      `${SCREENSHOT_DIR}/current-keyboard-shortcuts.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 5: Extensions marketplace ──────────────────────────────────

  test('extensions marketplace comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: click the "Extensions" activity bar button to reveal the
    // extensions panel and the marketplace overlay that opens automatically.
    await refPage.locator('button[title="Extensions"]').click();
    await refPage.waitForTimeout(1000);

    await screenshotRegion(
      refPage,
      null, // full-page includes sidebar + marketplace overlay
      `${SCREENSHOT_DIR}/reference-extensions.png`,
    );

    // Current: click the Extensions button in the activity bar
    await curPage.getByLabel('Extensions').click();
    await curPage.waitForSelector('[aria-label="Extensions"]', {
      timeout: 5000,
    });

    await screenshotRegion(
      curPage,
      'section.extensions-panel',
      `${SCREENSHOT_DIR}/current-extensions.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 6: Settings / Model configuration ──────────────────────────

  test('settings model configuration comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: click the "Settings" activity bar button
    await refPage.locator('button[title="Settings"]').click();
    await refPage.waitForTimeout(500);

    // The sidebar panel changes to the settings view – screenshot the
    // sidebar panel (second child of the flex container).
    await screenshotRegion(
      refPage,
      '#root > div > div:nth-child(2)',
      `${SCREENSHOT_DIR}/reference-settings.png`,
    );

    // Current: click the Settings button in the activity bar
    await curPage.getByLabel('Settings').click();
    await curPage.waitForSelector('[aria-label="Settings"]', {
      timeout: 5000,
    });

    await screenshotRegion(
      curPage,
      'section.settings-panel',
      `${SCREENSHOT_DIR}/current-settings.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 7: Memory bar ──────────────────────────────────────────────

  test('memory bar comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: the MemBar component renders inside the sidebar panel at
    // the bottom. It has a "Memory" label and a segmented bar. We target
    // the panel's last child div that contains the memory bar.
    // Since there's no dedicated class, use the known text content.
    const refMemBar = refPage
      .locator('div')
      .filter({ hasText: /^Memory/ })
      .first();
    await refMemBar.screenshot({
      path: `${SCREENSHOT_DIR}/reference-memory-bar.png`,
    });

    // Current: <div class="mem-bar" aria-label="Memory distribution">
    await screenshotRegion(
      curPage,
      '.mem-bar',
      `${SCREENSHOT_DIR}/current-memory-bar.png`,
    );

    await refPage.close();
    await curPage.close();
  });

  // ── Test 8: Chat interface ──────────────────────────────────────────

  test('chat interface comparison', async ({ browser }) => {
    const refPage = await browser.newPage();
    const curPage = await browser.newPage();

    await refPage.goto(REFERENCE_URL);
    await curPage.goto(CURRENT_URL);

    await waitForReference(refPage);
    await waitForCurrent(curPage);

    // Reference: the chat interface occupies the main content area (third
    // child of the top‑level flex container). Screenshot the full main area.
    await screenshotRegion(
      refPage,
      '#root > div > div:nth-child(3)',
      `${SCREENSHOT_DIR}/reference-chat.png`,
    );

    // Current: <section class="chat-panel" aria-label="Chat panel">
    await screenshotRegion(
      curPage,
      'section.chat-panel',
      `${SCREENSHOT_DIR}/current-chat.png`,
    );

    await refPage.close();
    await curPage.close();
  });
});
