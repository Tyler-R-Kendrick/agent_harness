import { expect, test, type Page } from '@playwright/test';

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: true,
  login: 'octocat',
  models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

async function mockCopilotStatus(page: Page) {
  await page.context().route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_COPILOT_STATUS),
    });
  });
}

test('Tools picker: header trigger and open popover', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.goto('/');

  await expect(page.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
  const trigger = page.getByRole('button', { name: /Configure tools/i });
  await expect(trigger).toBeVisible();

  await page.screenshot({ path: 'docs/screenshots/tools-picker-closed.png', fullPage: false });

  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Tools picker' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'CLI' })).toBeChecked();

  await page.screenshot({ path: 'docs/screenshots/tools-picker-open.png', fullPage: false });
});
