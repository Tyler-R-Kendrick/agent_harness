import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const SCREENSHOT_DIR = path.resolve(_dirname, '../docs/screenshots/regression');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'current-symphony-task-start.png');

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

test.describe('Symphony task start visual behavior', () => {
  test.setTimeout(90_000);

  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  test('new work-queue task visibly enters a running session', async ({ page }) => {
    const assertNoRuntimeErrors = captureRuntimeErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByLabel('Symphony').click();

    const app = page.getByRole('region', { name: 'Symphony task management system' });
    await expect(app).toBeVisible();
    await app.getByLabel('Symphony task request').fill('parallelize frontend, tests, and documentation work');
    await app.getByRole('button', { name: 'Start Symphony task' }).click();

    const queue = app.getByRole('region', { name: 'Symphony work queue' });
    await queue.getByLabel('New task title').fill('make a new widget');
    await queue.getByRole('button', { name: 'Create Symphony task' }).click();

    const newTask = queue.getByRole('button', { name: 'Open task SYM-004 make a new widget' });
    await expect(newTask).toBeVisible();
    await expect(queue.getByLabel('New task title')).toHaveValue('');

    const taskDetail = app.getByRole('region', { name: 'Symphony task detail' });
    await expect(taskDetail).toContainText('make a new widget');
    await expect(taskDetail).toContainText('Running');
    await expect(taskDetail).toContainText('StreamingTurn');
    await expect(app.getByRole('region', { name: 'Symphony activity summary' })).toHaveCount(0);

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    assertNoRuntimeErrors();
  });
});
