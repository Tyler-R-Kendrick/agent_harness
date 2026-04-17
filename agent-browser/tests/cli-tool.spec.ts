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

test('captures cli tool output in the active session terminal', async ({ page }) => {
  await mockCopilotStatus(page);
  await page.context().route('**/api/copilot/chat', async (route) => {
    const body = route.request().postDataJSON() as { prompt?: string };
    const hasToolResult = body.prompt?.includes('[tool_result name="cli"]');
    const content = hasToolResult
      ? 'I ran the terminal command.'
      : '<tool_call>{"tool":"cli","args":{"command":"echo hello from cli"}}</tool_call>';

    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({ type: 'final', content })}\n${JSON.stringify({ type: 'done' })}\n`,
    });
  });

  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
  await page.getByLabel('Chat input').fill('Check the terminal.');
  await page.getByRole('button', { name: 'Send' }).click();

  const toolChip = page.getByTestId('tool-chip-cli');
  await expect(toolChip).toBeVisible();
  await expect(page.getByText('$ echo hello from cli')).toBeVisible();
  await toolChip.locator('summary').click();
  await expect(page.getByText('hello from cli', { exact: true })).toBeVisible();
  await expect(page.getByText(/^(I ran the terminal command\.|Tool run completed\.)$/)).toBeVisible();

  await page.screenshot({ path: 'docs/screenshots/cli-tool-terminal-session.png', fullPage: true });
});