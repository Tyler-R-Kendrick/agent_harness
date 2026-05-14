import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const SCREENSHOT_DIR = path.resolve(_dirname, '../docs/screenshots/regression');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'current-symphony-task-completion.png');
const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: false,
  models: [] as Array<{ id: string; name: string; reasoning: boolean; vision: boolean }>,
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

function ensureScreenshotDir(): void {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

async function mockCopilotStatus(page: Page, overrides: Partial<typeof DEFAULT_COPILOT_STATUS> = {}) {
  await page.context().route(/\/api\/copilot\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...DEFAULT_COPILOT_STATUS, ...overrides }),
    });
  });
}

test.describe('Symphony task start visual behavior', () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  test('new work-queue task is dispatched to an agent session and completes', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('agent-browser.installed-models', JSON.stringify([]));
    });
    await mockCopilotStatus(page, {
      authenticated: true,
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: false }],
    });
    let chatRequestCount = 0;
    let latestChatPayload = '';
    await page.context().route(/\/api\/copilot\/chat$/, async (route) => {
      const payload = route.request().postDataJSON() as { prompt?: string };
      const serialized = JSON.stringify(payload || {});
      chatRequestCount += 1;
      latestChatPayload = serialized;
      const answer = serialized.includes('Assigned task: add 1+1.')
        ? 'Agent completed task: 1 + 1 = 2.'
        : 'Unexpected Symphony prompt.';
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ type: 'final', content: answer })}\n${JSON.stringify({ type: 'done' })}\n`,
      });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: /^(Open )?Session 1$/ }).click();
    await expect(page.getByRole('region', { name: 'Chat panel' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Agent provider' }).selectOption('ghcp');
    await page.getByRole('button', { name: 'Symphony', exact: true }).click();

    const app = page.getByRole('region', { name: 'Symphony task management system' });
    await expect(app).toBeVisible();
    await app.getByLabel('New project name').fill('Research');
    await app.getByRole('button', { name: 'Create Symphony project' }).click();

    const queue = app.getByRole('region', { name: 'Symphony work queue' });
    await queue.getByLabel('New task title').fill('add 1+1.');
    await queue.getByRole('button', { name: 'Create Symphony task' }).click();

    await expect.poll(() => chatRequestCount).toBeGreaterThan(0);
    expect(latestChatPayload).toContain('Assigned task: add 1+1.');
    await expect(page.getByText('Agent completed task: 1 + 1 = 2.')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Symphony', exact: true }).click();

    const refreshedApp = page.getByRole('region', { name: 'Symphony task management system' });
    const refreshedQueue = refreshedApp.getByRole('region', { name: 'Symphony work queue' });
    const newTask = refreshedQueue.getByRole('button', { name: 'Open task SYM-001 add 1+1.' });
    await expect(newTask).toBeVisible({ timeout: 20_000 });
    await expect(refreshedQueue.getByLabel('New task title')).toHaveValue('');

    const taskDetail = refreshedApp.getByRole('region', { name: 'Symphony task detail' });
    await expect(taskDetail).toContainText('add 1+1.');
    await expect(taskDetail).toContainText('Done');
    await expect(taskDetail).toContainText('Finishing');
    await expect(taskDetail).toContainText('recorded');

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    assertNoRuntimeErrors();
  });
});
