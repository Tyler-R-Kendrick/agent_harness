import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function mockCopilotStatus(page: Page, overrides: Partial<typeof DEFAULT_COPILOT_STATUS> = {}) {
  await page.route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...DEFAULT_COPILOT_STATUS, ...overrides }),
    });
  });
}

async function expectNoCriticalA11yViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const axeApi = (window as typeof window & { axe: typeof axe }).axe;
    return axeApi.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
  });

  const blockingViolations = result.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ));

  expect(
    blockingViolations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

async function expectNoHorizontalViewportOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVisibleLocatorWithinViewport(page: Page, locatorLabel: string, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${locatorLabel} should have a visible bounding box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x, `${locatorLabel} should not overflow left`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `${locatorLabel} should not overflow top`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${locatorLabel} should not overflow right`).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height, `${locatorLabel} should not overflow bottom`).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectMobileTouchTargets(page: Page) {
  const tooSmall = await page.evaluate(() => {
    const selectors = [
      '.activity-button',
      '.mode-tab',
      '.icon-button',
      '.tree-button',
      '.workspace-card-button',
      '.secondary-button',
      '.primary-button',
    ].join(',');
    return Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        return rect.width < 40 || rect.height < 40;
      })
      .map((element) => ({
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.className,
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      }));
  });
  expect(tooSmall).toEqual([]);
}

async function openPrimarySession(page: Page) {
  const chatPanel = page.getByRole('region', { name: 'Chat panel' });
  if (await chatPanel.count()) return;
  await page.getByRole('button', { name: 'Open Session 1' }).click();
  await expect(chatPanel).toBeVisible();
}

test.describe('mobile-first accessibility viewport matrix', () => {
  for (const viewport of VIEWPORTS) {
    test(`workspace shell is visible, navigable, and accessible on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockCopilotStatus(page);
      await page.goto('/');

      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
      await expect(page.getByRole('main', { name: 'Workspace content' })).toBeVisible();
      await openPrimarySession(page);
      await expect(page.getByRole('region', { name: 'Chat panel' })).toBeVisible();
      await expect(page.getByLabel('Chat input')).toBeVisible();
      await expect(page.getByRole('button', { name: /sidebar/i })).toBeVisible();

      await expectNoHorizontalViewportOverflow(page);
      await expectVisibleLocatorWithinViewport(page, 'primary navigation', 'nav.activity-bar');
      await expectVisibleLocatorWithinViewport(page, 'workspace content', 'main.content-area');
      if (viewport.name === 'phone') {
        await expectMobileTouchTargets(page);
      }
      await expectNoCriticalA11yViolations(page);
    });

    test(`workspace controls and overlays fit on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockCopilotStatus(page);
      await page.goto('/');

      const sidebarToggle = page.getByRole('button', { name: /sidebar/i });
      if (await page.locator('aside.sidebar').count() === 0) {
        await sidebarToggle.click();
      }

      await expect(page.getByLabel('Workspace tree')).toBeVisible();
      await expect(page.getByLabel('Omnibar')).toBeVisible();
      await expect(page.getByLabel('Open keyboard shortcuts')).toBeVisible();

      await page.getByLabel('Open keyboard shortcuts').click();
      const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
      await expect(shortcuts).toBeVisible();
      await expect(shortcuts.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
      await expectVisibleLocatorWithinViewport(page, 'keyboard shortcuts dialog', '.shortcuts-card');
      await page.keyboard.press('Escape');
      await expect(shortcuts).toHaveCount(0);

      await page.getByLabel('Toggle workspace overlay').click();
      const switcher = page.getByRole('dialog', { name: 'Workspace switcher' });
      await expect(switcher).toBeVisible();
      await expect(switcher.getByRole('button', { name: /New workspace/i })).toBeVisible();
      await expectVisibleLocatorWithinViewport(page, 'workspace switcher dialog', '.workspace-switcher-card');
      await expectNoHorizontalViewportOverflow(page);
      await expectNoCriticalA11yViolations(page);
    });
  }

  test('sidebar follows viewport breakpoint until the user explicitly toggles it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCopilotStatus(page);
    await page.goto('/');

    await expect(page.locator('aside.sidebar')).toHaveCount(0);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByLabel('Workspace tree')).toBeVisible();

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('aside.sidebar')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('aside.sidebar')).toHaveCount(0);
  });
});
