import { expect, test } from '@playwright/test';

/**
 * Visual smoke tests for the operation-pane workflow visualization.
 *
 * The fixture page (`/operation-fixture.html`) mounts the production
 * components with deterministic mock data so screenshots are reproducible
 * without needing the local-model runtime (WebGPU is unavailable in the
 * dev container, so live Codi/Ghcp inference can't drive the workflow).
 */

test('workflow graph renders with parallel subagents', async ({ page }) => {
  await page.goto('/operation-fixture.html?fixture=workflow-graph');

  await expect(page.getByRole('complementary', { name: 'Process graph' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Coordinator brief/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Breakdown subagent/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Assignment subagent/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Validation subagent/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reviewer votes/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /AgentBus log/ })).toBeVisible();

  await page.screenshot({
    path: 'docs/screenshots/workflow-graph.png',
    fullPage: true,
  });
});

test('workflow drill-down opens the subagent thoughts pane', async ({ page }) => {
  await page.goto('/operation-fixture.html?fixture=workflow-drilldown');

  await expect(page.getByRole('complementary', { name: 'Process graph' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: /breakdown-agent .* detail/i })).toBeVisible();
  await expect(page.getByText('Slice 1: data plumbing')).toBeVisible();

  await page.screenshot({
    path: 'docs/screenshots/workflow-drilldown.png',
    fullPage: true,
  });
});

test('process drill-down renders reviewer rationale', async ({ page }) => {
  await page.goto('/operation-fixture.html?fixture=process-vote-detail');

  await expect(page.getByRole('complementary', { name: 'Process graph' })).toBeVisible();
  const detailPane = page.getByRole('complementary', { name: /voter:breakdown-distinct-tracks .* detail/i });
  await expect(detailPane).toBeVisible();
  await expect(detailPane.getByText(/parallel tracks/i).first()).toBeVisible();

  await page.screenshot({
    path: 'docs/screenshots/workflow-vote-detail.png',
    fullPage: true,
  });
});

test('process drill-down renders bus payload detail', async ({ page }) => {
  await page.goto('/operation-fixture.html?fixture=process-bus-detail');

  await expect(page.getByRole('complementary', { name: 'Process graph' })).toBeVisible();
  const detailPane = page.getByRole('complementary', { name: /bus inf-in detail/i });
  await expect(detailPane).toBeVisible();
  await expect(detailPane.getByText(/delegation-worker:sectioned-plan/i).first()).toBeVisible();

  await page.screenshot({
    path: 'docs/screenshots/workflow-bus-detail.png',
    fullPage: true,
  });
});
