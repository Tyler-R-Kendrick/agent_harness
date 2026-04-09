import { expect, test, type Page } from '@playwright/test';

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  const isLocalUrl = (url: string) => url.startsWith('http://127.0.0.1:4173/') || url.startsWith('http://localhost:4173/');
  const isCriticalAssetUrl = (url: string) => /\.(?:js|mjs|css|wasm)(?:$|\?)/.test(url);
  const isIgnoredLocalUrl = (url: string) => url.endsWith('/favicon.ico') || url.includes('/copilotkit');
  const isCriticalConsoleError = (text: string) => [
    'Failed to load module script',
    'Expected a JavaScript module script',
    'Strict MIME type checking',
    'wasm module script',
    'Unexpected token',
  ].some((fragment) => text.includes(fragment));

  page.on('console', (message) => {
    if (message.type() === 'error' && isCriticalConsoleError(message.text())) {
      errors.push(`console:${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror:${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (isLocalUrl(url) && !isIgnoredLocalUrl(url) && isCriticalAssetUrl(url)) {
      errors.push(`requestfailed:${request.method()} ${url} ${request.failure()?.errorText ?? 'unknown error'}`);
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (isLocalUrl(url) && !isIgnoredLocalUrl(url) && isCriticalAssetUrl(url) && response.status() >= 400) {
      errors.push(`response:${response.status()} ${url}`);
    }
  });

  return () => expect(errors, errors.join('\n')).toEqual([]);
}

// ── Screen capture tests ──────────────────────────────────────────────

test('captures the main workspace screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  // The tree shows workspaces with tabs and a "+" button to add files
  await expect(page.getByLabel('Workspace tree')).toBeVisible();
  // Add a file via the "+" button on Research workspace
  await page.getByLabel('Add file to Research').click();
  await expect(page.getByRole('dialog', { name: 'Add file' })).toBeVisible();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  // AGENTS.md should appear in the tree and open in the file editor
  await expect(page.getByLabel('Workspace file path')).toHaveValue('AGENTS.md');
  // Add a skill
  await page.getByLabel('Add file to Research').click();
  await page.getByLabel('Capability name').fill('review-pr');
  await page.getByRole('button', { name: 'Skill' }).click();
  await expect(page.getByLabel('Workspace file path')).toHaveValue('.agents/skill/review-pr/SKILL.md');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-screen.png', fullPage: true });
});

test('captures the settings screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByLabel('Hugging Face search')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/settings-screen.png', fullPage: true });
});

test('captures the extensions screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Extensions').click();
  await expect(page.getByText('Workspace plugin manifests')).toBeVisible();
  await expect(page.getByText('No plugin manifests stored yet.')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByText('Recent sessions')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});

// ── User flow: chat interaction ───────────────────────────────────────

test('captures the chat panel with composer', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await expect(page.getByText('Agent Chat')).toBeVisible();
  await expect(page.getByText('Workspace assistant', { exact: true })).toBeVisible();
  // Fill the composer to show the typing state
  await page.getByLabel('Chat input').fill('What local models are available?');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-composer.png', fullPage: true });
});

// ── User flow: workspace switcher modal ───────────────────────────────

test('captures the workspace switcher modal', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Click the workspace overlay toggle to open the switcher
  await page.getByLabel('Omnibar').waitFor();
  await page.getByLabel('Toggle workspace overlay').click();
  await expect(page.getByRole('dialog', { name: 'Workspace switcher' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-switcher.png', fullPage: true });
});

// ── User flow: keyboard shortcuts modal ───────────────────────────────

test('captures the keyboard shortcuts modal', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Omnibar').waitFor();
  // Press ? to open keyboard shortcuts overlay
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(page.getByText('Ctrl+Alt+←/→')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/keyboard-shortcuts.png', fullPage: true });
});

// ── User flow: page overlay (opening a tab) ───────────────────────────

test('captures the page overlay when opening a tab', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Click on a tab in the tree (e.g. "Hugging Face")
  await page.getByRole('button', { name: /Hugging Face/ }).first().click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(page.getByLabel('Address')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/page-overlay.png', fullPage: true });
});

// ── User flow: sidebar collapse and expand ────────────────────────────

test('captures the sidebar collapsed state', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Omnibar').waitFor();
  // Click the collapse sidebar button
  await page.getByLabel('Collapse sidebar').click();
  // Sidebar should be hidden – the omnibar is no longer visible
  await expect(page.getByLabel('Omnibar')).not.toBeVisible();
  // The main chat panel should still be visible
  await expect(page.getByLabel('Chat input')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/sidebar-collapsed.png', fullPage: true });
});

// ── User flow: omnibar navigation ─────────────────────────────────────

test('captures omnibar URL navigation creating a new tab', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Type a URL in the omnibar and submit
  await page.getByLabel('Omnibar').fill('https://example.com');
  await page.getByLabel('Omnibar').press('Enter');
  // A page overlay should appear for the navigated URL
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(page.getByText('https://example.com', { exact: true })).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/omnibar-navigation.png', fullPage: true });
});

// ── User flow: workspace file editing ─────────────────────────────────

test('captures workspace file edit and delete flow', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Add a file via the tree "+" button
  await page.getByLabel('Add file to Research').click();
  await page.getByLabel('Capability name').fill('test-hook');
  await page.getByRole('button', { name: 'Hook' }).click();
  // File editor opens in the content area
  await expect(page.getByLabel('Workspace file path')).toHaveValue('.agents/hooks/test-hook.sh');
  // Edit the content
  await page.getByLabel('Workspace file content').fill('{"name": "test-hook", "version": "1.0"}');
  // Save the file (force click past any CopilotKit error overlay)
  await page.getByRole('button', { name: 'Save file' }).click({ force: true });
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-file-edit.png', fullPage: true });
});

// ── User flow: switching workspaces ───────────────────────────────────

test('captures workspace switching via hotkeys', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Verify we start on Research workspace by checking tree has Research tabs
  await expect(page.getByRole('button', { name: /Hugging Face/ }).first()).toBeVisible();
  // Use the target workspace hotkey to switch
  await page.keyboard.press('Control+Alt+ArrowRight');
  // The workspace tree should update (Build workspace has CopilotKit docs tab)
  await expect(page.getByRole('button', { name: /CopilotKit docs/ }).first()).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-switch.png', fullPage: true });
});
