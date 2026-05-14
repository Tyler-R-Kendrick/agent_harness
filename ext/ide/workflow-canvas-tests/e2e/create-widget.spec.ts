import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const screenshotPath = fileURLToPath(new URL('../../../../output/playwright/workflow-canvas-create-widget.png', import.meta.url));

test('creates a workflow widget from the canvas context menu', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const canvas = page.getByRole('region', { name: 'Workflow orchestration canvas' });
  await expect(canvas).toBeVisible();

  await page.getByRole('button', { name: 'Run workflow' }).click();
  await expect(page.getByRole('region', { name: 'Workflow execution replay' })).toContainText('Run complete');
  await expect(page.getByRole('region', { name: 'Workflow execution replay' })).toContainText('success');
  await expect(page.getByRole('region', { name: 'Workflow integration readiness' })).toContainText('6/6 ready');
  await expect(page.getByRole('region', { name: 'Workflow binding map' })).toContainText('9 data bindings');

  await canvas.click({ button: 'right', position: { x: 420, y: 210 } });
  const contextMenu = page.getByRole('menu', { name: 'Workflow canvas context menu' });
  await expect(contextMenu).toBeVisible();

  await page.getByRole('menuitem', { name: 'Create Widget' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create workflow widget' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Widget prompt').fill('Track launch blockers by owner and urgency');
  await dialog.getByRole('button', { name: 'Create widget' }).click();

  await expect(canvas.getByRole('button', { name: 'Inspect Track launch blockers widget' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workflow node inspector' })).toContainText('Track launch blockers');

  await page.getByRole('button', { name: 'Save canvas artifact' }).click();
  await expect(page.getByRole('status', { name: 'Workflow canvas save status' })).toContainText('Saved workflow-canvas/campaign-launch.json');

  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
});
