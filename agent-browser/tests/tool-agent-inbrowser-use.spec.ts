import { expect, test, type Page } from '@playwright/test';

const HARNESS_URL = '/tool-agent-harness.html';

/** Wait for the agent to be bootstrapped on window. */
async function waitForAgent(page: Page): Promise<void> {
  await page.waitForFunction(() => '__inBrowserUse' in window, { timeout: 10_000 });
}

test.describe('InBrowserUse tool-agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL);
    await waitForAgent(page);
  });

  test('clicks a button by CSS selector', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#btn')
        .click();
    });
    await expect(page.locator('#result')).toHaveText('clicked');
  });

  test('fills an input by CSS selector', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#name')
        .fill('Alice');
    });
    await expect(page.locator('#name')).toHaveValue('Alice');
  });

  test('reads text content of an element', async ({ page }) => {
    const text = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#btn')
        .textContent(),
    );
    expect(text).toBe('Click me');
  });

  test('checks element visibility', async ({ page }) => {
    const visible = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#btn')
        .isVisible(),
    );
    expect(visible).toBe(true);
  });

  test('counts matching elements', async ({ page }) => {
    const count = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('button')
        .count(),
    );
    expect(count).toBe(1);
  });

  test('reads input value after fill', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#name')
        .fill('Bob');
    });
    const value = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#name')
        .inputValue(),
    );
    expect(value).toBe('Bob');
  });

  test('clicks by ARIA role', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .getByRole('button')
        .click();
    });
    await expect(page.locator('#result')).toHaveText('clicked');
  });

  test('fills by placeholder text', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .getByPlaceholder('Your name')
        .fill('Charlie');
    });
    await expect(page.locator('#name')).toHaveValue('Charlie');
  });

  test('selects a dropdown option', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#color')
        .selectOption('red');
    });
    await expect(page.locator('#color')).toHaveValue('red');
  });

  test('checks element is enabled', async ({ page }) => {
    const enabled = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#btn')
        .isEnabled(),
    );
    expect(enabled).toBe(true);
  });

  test('disabled element is not enabled', async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('btn') as HTMLButtonElement).disabled = true;
    });
    const enabled = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .locator('#btn')
        .isEnabled(),
    );
    expect(enabled).toBe(false);
  });

  test('get by label text', async ({ page }) => {
    const count = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .getByLabel('Name')
        .count(),
    );
    expect(count).toBe(1);
  });

  test('get by text content', async ({ page }) => {
    const text = await page.evaluate(async () =>
      (window as unknown as Record<string, any>).__inBrowserUse
        .getByText('Click me')
        .textContent(),
    );
    expect(text).toBe('Click me');
  });
});
