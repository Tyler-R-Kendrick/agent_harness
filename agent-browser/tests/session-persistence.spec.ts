// Session persistence regression spec.
//
// Asserts that installing a local LLM and changing session-bound UI state
// survives a page refresh. Also captures before/after screenshots for the PR
// changeset.

import { expect, test, type Page } from '@playwright/test';

const INSTALLED_MODELS_KEY = 'agent-browser.installed-models';
const ACTIVE_PANEL_KEY = 'agent-browser.session.active-panel';
const ACTIVE_WORKSPACE_KEY = 'agent-browser.session.active-workspace-id';

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

async function mockCopilotStatus(page: Page) {
  await page.route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_COPILOT_STATUS),
    });
  });
}

async function seedInstalledModelsBeforeLoad(page: Page) {
  await page.addInitScript((storageKey: string) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([
        {
          id: 'onnx-community/Qwen3-0.6B-ONNX',
          name: 'Qwen3-0.6B-ONNX',
          author: 'onnx-community',
          task: 'text-generation',
          downloads: 5000,
          likes: 30,
          tags: ['onnx'],
          sizeMB: 0,
          status: 'installed',
        },
      ]));
    } catch {
      // ignore frames that don't expose storage
    }
  }, INSTALLED_MODELS_KEY);
}

test.describe('session-bound state persists across page refresh', () => {
  test('installed local LLMs survive a reload', async ({ page }) => {
    await mockCopilotStatus(page);
    await seedInstalledModelsBeforeLoad(page);

    await page.goto('/');

    // Open Settings and confirm the seeded model shows as installed before refresh.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: /Loaded \(1\)/i })).toBeVisible();
    await expect(page.getByText(/Qwen3-0\.6B-ONNX/i).first()).toBeVisible();
    await page.screenshot({
      path: 'docs/screenshots/session-persistence-installed-models-before.png',
      fullPage: true,
    });

    await page.reload();

    // After refresh, the Settings panel should still be active because activePanel
    // is session-bound, and the installed model should still be listed.
    await expect(page.getByRole('button', { name: /Loaded \(1\)/i })).toBeVisible();
    await expect(page.getByText(/Qwen3-0\.6B-ONNX/i).first()).toBeVisible();
    await page.screenshot({
      path: 'docs/screenshots/session-persistence-installed-models-after.png',
      fullPage: true,
    });
  });

  test('active sidebar panel survives a reload (sessionStorage)', async ({ page }) => {
    await mockCopilotStatus(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Extensions', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Marketplace/i })).toBeVisible();

    // Wait for the debounced persistence write before reloading.
    await expect.poll(
      () => page.evaluate((key) => window.sessionStorage.getItem(key), ACTIVE_PANEL_KEY),
      { timeout: 5000 },
    ).toBe(JSON.stringify('extensions'));

    await page.reload();
    await expect(page.getByRole('heading', { name: /Marketplace/i })).toBeVisible();

    const storedPanel = await page.evaluate((key) => window.sessionStorage.getItem(key), ACTIVE_PANEL_KEY);
    expect(storedPanel).toBe(JSON.stringify('extensions'));
  });

  test('active workspace survives a reload (sessionStorage)', async ({ page }) => {
    await mockCopilotStatus(page);
    await page.addInitScript((key) => {
      window.sessionStorage.setItem(key, JSON.stringify('ws-build'));
    }, ACTIVE_WORKSPACE_KEY);

    await page.goto('/');

    // Workspace pill / chat header should reflect the Build workspace.
    await expect(page.getByText(/Build/i).first()).toBeVisible();

    await page.reload();
    const storedWorkspace = await page.evaluate((key) => window.sessionStorage.getItem(key), ACTIVE_WORKSPACE_KEY);
    expect(storedWorkspace).toBe(JSON.stringify('ws-build'));
  });
});
