import { expect, test, type Page } from '@playwright/test';

const SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY = 'agent-browser.sandbox.flags';

const DEFAULT_COPILOT_STATUS = {
  available: true,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

async function mockCopilotStatus(page: Page, overrides: Partial<typeof DEFAULT_COPILOT_STATUS> = {}) {
  await page.route('**/api/copilot/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...DEFAULT_COPILOT_STATUS, ...overrides }),
    });
  });
}

async function invokeWebMcpTool<T>(page: Page, toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(async ({ toolName, args }) => {
    const modelContext = (navigator as Navigator & { modelContext?: unknown }).modelContext as Record<PropertyKey, unknown> | undefined;
    if (!modelContext) {
      throw new Error('WebMCP model context is unavailable.');
    }

    const registry = Object.getOwnPropertySymbols(modelContext)
      .map((symbol) => modelContext[symbol])
      .find((candidate) => {
        if (!candidate || typeof candidate !== 'object') return false;
        const maybeRegistry = candidate as { get?: (name: string) => unknown; list?: () => unknown[] };
        return typeof maybeRegistry.get === 'function'
          && typeof maybeRegistry.list === 'function'
          && Boolean(maybeRegistry.get(toolName));
      }) as { get: (name: string) => { execute?: (input: object, client: object) => Promise<unknown> | unknown } | undefined } | undefined;

    const tool = registry?.get(toolName);
    if (!tool?.execute) {
      throw new Error(`WebMCP tool "${toolName}" is not registered.`);
    }

    return await tool.execute(args, {});
  }, { toolName, args }) as Promise<T>;
}

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

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title === 'captures the settings screen') {
    return;
  }
  await mockCopilotStatus(page);
});

/** Click the Terminal mode tab (bypassing any overlays). */
async function switchToTerminalMode(page: Page) {
  const tab = page.getByRole('tab', { name: 'Terminal mode' });
  await expect(tab).toBeVisible();
  await tab.click({ force: true });
}

/** Click the Chat mode tab (bypassing any overlays). */
async function switchToChatMode(page: Page) {
  const tab = page.getByRole('tab', { name: 'Chat mode' });
  await expect(tab).toBeVisible();
  await tab.click({ force: true });
}

async function ensureFilesExpanded(page: Page) {
  const workspaceDrive = page.getByRole('button', { name: '//workspace', exact: true });
  const sessionDrive = page.getByRole('button', { name: /\/\/session-\d+-fs/, exact: false });
  if (await workspaceDrive.count() === 0 && await sessionDrive.count() === 0) {
    await page.getByRole('button', { name: 'Files', exact: true }).first().click();
  }
}

async function clickTreeButton(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click();
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
  const addFileDialog = page.getByRole('dialog', { name: 'Add file' });
  await expect(addFileDialog).toBeVisible();
  await addFileDialog.getByRole('button', { name: 'AGENTS.md', exact: true }).click();
  // AGENTS.md should appear in the tree and open in the file editor
  await expect(page.getByRole('region', { name: 'File editor' }).locator('.file-editor-path-text')).toHaveText('AGENTS.md');
  // Add a skill
  await page.getByLabel('Add file to Research').click();
  await expect(addFileDialog).toBeVisible();
  await addFileDialog.getByLabel('Capability name').fill('review-pr');
  await addFileDialog.getByRole('button', { name: 'Skill', exact: true }).click();
  await expect(page.getByRole('region', { name: 'File editor' }).locator('.file-editor-path-text')).toHaveText('.agents/skills/review-pr/SKILL.md');

  await ensureFilesExpanded(page);
  await expect(page.getByRole('button', { name: '//workspace', exact: true })).toBeVisible();
  await clickTreeButton(page, '//workspace');
  await expect(page.getByRole('button', { name: '.agents', exact: true })).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-screen.png', fullPage: true });
});

test('closes AGENTS.md after save', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Add file to Research').click();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  await expect(page.getByRole('region', { name: 'File editor' }).locator('.file-editor-path-text')).toHaveText('AGENTS.md');
  await page.getByLabel('Workspace file content').fill('# Rules\nAlways verify workspace instructions.');
  await page.getByRole('button', { name: 'Save file' }).click({ force: true });
  await expect(page.getByLabel('Workspace file path')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Chat panel' })).toBeVisible();
  assertNoRuntimeErrors();
});

test('captures startup render without crypto.randomUUID', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.addInitScript(() => {
    const originalCrypto = window.crypto;
    if (!originalCrypto) return;
    const cryptoWithoutRandomUuid = new Proxy(originalCrypto, {
      get(target, prop) {
        if (prop === 'randomUUID') return undefined;
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: cryptoWithoutRandomUuid,
    });
  });
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await expect(page.getByLabel('Workspace tree')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/runtime-fallback-render.png', fullPage: true });
});

test('captures categorized worktree with agent and terminal instances', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Browser' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sessions' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Files' }).first()).toBeVisible();

  await page.getByLabel('Add session to Research').click();
  await expect(page.getByRole('button', { name: 'Session 2', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Session 2', exact: true }).click();
  await page.getByRole('tab', { name: 'Terminal mode' }).click();
  await expect(page.getByLabel('Bash input')).toBeVisible();
  await page.getByLabel('Bash input').fill('touch notes.txt');
  await page.getByLabel('Bash input').press('Enter');
  await expect(page.getByLabel('Bash input')).toBeEnabled({ timeout: 10000 });

  await ensureFilesExpanded(page);
  await expect(page.getByRole('button', { name: '//session-2-fs', exact: true })).toBeVisible();
  await clickTreeButton(page, '//session-2-fs');
  await expect(page.getByRole('button', { name: '//workspace', exact: true })).toBeVisible();
  await clickTreeButton(page, 'workspace');
  await expect(page.getByRole('button', { name: 'workspace', exact: true })).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/worktree-categories.png', fullPage: true });
});

test('autocompletes workspace skills and recalls terminal input history', async ({ page }) => {
  await mockCopilotStatus(page, {
    authenticated: true,
    login: 'octocat',
    models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: false }],
  });
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  await switchToTerminalMode(page);
  const bashInput = page.getByLabel('Bash input');
  await expect(bashInput).toBeVisible();

  await bashInput.fill('echo first');
  await bashInput.press('Enter');
  await expect(page.getByText('$ echo first')).toBeVisible();

  await bashInput.fill('pwd');
  await bashInput.press('Enter');
  await expect(page.getByLabel('Terminal output').getByText('/workspace', { exact: true })).toBeVisible();

  await bashInput.press('ArrowUp');
  await expect(bashInput).toHaveValue('pwd');
  await bashInput.press('ArrowUp');
  await expect(bashInput).toHaveValue('echo first');
  await bashInput.press('ArrowDown');
  await expect(bashInput).toHaveValue('pwd');
  await bashInput.press('ArrowDown');
  await expect(bashInput).toHaveValue('');

  await switchToChatMode(page);
  const chatInput = page.getByLabel('Chat input');
  await chatInput.fill('Use @create');

  const skillSuggestions = page.getByRole('listbox', { name: 'Skill suggestions' });
  await expect(skillSuggestions).toBeVisible();
  await expect(page.getByRole('option', { name: 'create-agent', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'create-agent-eval', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'create-agent-skill', exact: true })).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-skill-autocomplete-history.png', fullPage: true });

  await page.getByRole('option', { name: 'create-agent-skill', exact: true }).click();
  await expect(chatInput).toHaveValue('Use @create-agent-skill ');
});

test('captures the settings screen', async ({ browser }) => {
  const page = await browser.newPage();
  await mockCopilotStatus(page, {
    authenticated: true,
    login: 'octocat',
    models: Array.from({ length: 4 }, (_entry, index) => ({
      id: `gpt-4.${index + 1}`,
      name: `GPT-4.${index + 1}`,
      reasoning: true,
      vision: index % 2 === 0,
      billingMultiplier: 1,
    })),
  });
  await page.route('https://huggingface.co/api/models**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Array.from({ length: 10 }, (_entry, index) => ({
        id: `test-org/model-${index + 1}`,
        pipeline_tag: 'text-generation',
        downloads: 1000 - index,
        likes: 100 - index,
        tags: ['onnx', 'transformers.js'],
        safetensors: { total: 42_000_000 },
      }))),
    });
  });
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByLabel('Hugging Face search')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh status' })).toBeVisible();
  await expect(page.locator('.chip.active')).toHaveCount(0);

  await page.getByLabel('Hugging Face search').fill('qwen');
  const resultsToggle = page.locator('.settings-result-list .section-toggle');
  await expect(resultsToggle).toContainText('Results');
  await expect(resultsToggle).toHaveAttribute('aria-expanded', 'true');

  const settingsPanel = page.locator('.settings-panel');
  const panelOverflowY = await settingsPanel.evaluate((element) => window.getComputedStyle(element).overflowY);
  expect(['auto', 'scroll']).toContain(panelOverflowY);

  // Chip-row must be a single horizontal scrollable row — no wrapping.
  const chipRow = page.locator('.settings-panel .chip-row');
  const chipRowStyles = await chipRow.evaluate((element) => {
    const cs = window.getComputedStyle(element);
    return {
      flexWrap: cs.flexWrap,
      overflowX: cs.overflowX,
      rowCount: element.scrollHeight > element.clientHeight ? 'multi' : 'single',
    };
  });
  expect(chipRowStyles.flexWrap).toBe('nowrap');
  expect(['auto', 'scroll']).toContain(chipRowStyles.overflowX);
  expect(chipRowStyles.rowCount).toBe('single');

  // Local models body must scroll when content overflows.
  const localModelsBody = page.locator('.local-models-body');
  await expect(localModelsBody).toBeVisible();
  const localModelsScrollState = await localModelsBody.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: window.getComputedStyle(element).overflowY,
  }));
  expect(localModelsScrollState.scrollHeight).toBeGreaterThan(localModelsScrollState.clientHeight);
  expect(['auto', 'scroll']).toContain(localModelsScrollState.overflowY);

  const resultsBody = page.locator('.settings-result-list .settings-section-body');
  await expect(resultsBody.locator('.model-card').nth(5)).toBeVisible();

  const providersToggle = page.getByRole('button', { name: /Providers/i });
  await expect(providersToggle).toHaveAttribute('aria-expanded', 'true');
  await providersToggle.click();
  await expect(providersToggle).toHaveAttribute('aria-expanded', 'false');
  await providersToggle.click();
  await expect(providersToggle).toHaveAttribute('aria-expanded', 'true');

  const recommendedToggle = page.locator('.collapsible-section .section-toggle[aria-expanded="true"]').first();
  await expect(recommendedToggle).toBeVisible();

  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toHaveAttribute('aria-expanded', 'true');

  await expect(page.locator('.model-card').first()).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/settings-screen.png', fullPage: true });
  await page.close();
});

test('captures GHCP as the default chat provider when it is the only ready agent', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.unroute('**/api/copilot/status');
  await mockCopilotStatus(page, {
    authenticated: true,
    models: [{
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      reasoning: true,
      vision: true,
      billingMultiplier: 1,
    }],
  });

  await page.goto('/');
  await expect(page.getByLabel('Agent provider')).toHaveValue('ghcp');
  await expect(page.getByLabel('GHCP model')).toHaveValue('gpt-4.1');
  await expect(page.getByLabel('Chat input')).toHaveAttribute('placeholder', 'Ask GHCP…');

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-ghcp-default.png', fullPage: true });
});

test('captures the extensions screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Extensions').click();
  await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
  await expect(page.getByLabel('Search extensions')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});

// ── User flow: chat interaction ───────────────────────────────────────

test('captures the chat panel with composer', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Chat mode' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Terminal mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New session' })).toBeVisible();
  await expect(page.getByText(/workspace\/research/i)).toBeVisible();
  // Fill the composer to show the typing state
  await page.getByLabel('Chat input').fill('What local models are available?');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-composer.png', fullPage: true });
});

test('captures the secure shared chat QR pairing dialog', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Share chat session' }).click();
  await expect(page.getByRole('dialog', { name: 'Share chat session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start shared session' })).toBeVisible();
  await expect(page.getByText(/QR is untrusted signaling/i)).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/shared-chat-pairing.png', fullPage: true });
});

test('captures the stop-response state in chat', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.route(/browserInference\.worker/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
self.onmessage = (event) => {
  const data = event.data || {};
  const id = String(data.id || '');
  if (!id) return;
  if (data.action === 'load') {
    self.postMessage({ type: 'done', id, result: { loaded: true } });
    return;
  }
  if (data.action === 'generate') {
    self.postMessage({ type: 'phase', id, phase: 'thinking' });
    setTimeout(() => {
      self.postMessage({ type: 'token', id, token: 'Draft answer in progress' });
    }, 20);
  }
};`,
    });
  });

  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByRole('button', { name: /Load/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /Load/i }).first().click();
  await expect(page.getByText(/loaded/i)).toBeVisible();

  await page.getByLabel('Workspaces').click();
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await page.getByLabel('Chat input').fill('Write a long answer.');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
  await expect(page.getByText('Draft answer in progress')).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-stop-response.png', fullPage: true });

  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(page.getByText('Stopped')).toBeVisible();
});

test('reuses one GHCP session across tool-loop chat requests', async ({ page }) => {
  await mockCopilotStatus(page, {
    authenticated: true,
    models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: false }],
  });
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  const requests: Array<{ sessionId?: string; prompt?: string }> = [];

  await page.route('**/api/copilot/chat', async (route) => {
    const payload = route.request().postDataJSON() as { sessionId?: string; prompt?: string };
    requests.push(payload);

    if (requests.length === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ type: 'final', content: '<tool_call>{"tool":"cli","args":{"command":"echo hello from playwright"}}</tool_call>' })}\n${JSON.stringify({ type: 'done' })}\n`,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({ type: 'final', content: 'CLI check complete.' })}\n${JSON.stringify({ type: 'done' })}\n`,
    });
  });

  await page.goto('/');
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await page.getByLabel('Chat input').fill('Run a CLI check.');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('CLI check complete.')).toBeVisible();
  await expect(page.getByTestId('tool-chip-cli')).toBeVisible();

  expect(requests).toHaveLength(2);
  expect(requests[0]?.sessionId).toBeTruthy();
  expect(requests[0]?.sessionId).toBe(requests[1]?.sessionId);
  assertNoRuntimeErrors();
});

test('renders a session-fs workspace symlink as a reference file and saves through to the original', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);

  await page.goto('/');
  await expect(page.getByLabel('Workspace tree')).toBeVisible();

  await invokeWebMcpTool(page, 'add_filesystem_entry', {
    action: 'create',
    targetType: 'workspace-file',
    kind: 'file',
    path: 'AGENTS.md',
    content: '# Original\nKeep this synced.',
  });

  const createdReference = await invokeWebMcpTool<{ path: string; content: string }>(page, 'add_filesystem_entry', {
    action: 'symlink',
    targetType: 'session-fs-entry',
    kind: 'file',
    path: '//session-1-fs/workspace',
    sourcePath: '//workspace/AGENTS.md',
  });

  expect(createdReference).toMatchObject({
    path: '/workspace/AGENTS.md',
    content: 'workspace://AGENTS.md',
  });

  await ensureFilesExpanded(page);
  await clickTreeButton(page, '//session-1-fs');
  await clickTreeButton(page, 'workspace');

  const referenceRow = page.locator('[role="treeitem"].tree-row-reference').filter({ hasText: 'AGENTS.md' });
  await expect(referenceRow).toHaveCount(1);
  await expect(referenceRow.locator('[data-icon="link"]')).toBeVisible();

  await referenceRow.getByRole('button', { name: 'AGENTS.md', exact: true }).click();

  await expect(page.getByRole('region', { name: 'File editor' })).toContainText('AGENTS.md');
  await expect(page.getByLabel('Workspace file content')).toHaveValue('# Original\nKeep this synced.');

  await page.getByLabel('Workspace file content').fill('# Updated\nKeep this synced through refs.');
  await page.getByRole('button', { name: 'Save file' }).click({ force: true });

  const updatedFile = await invokeWebMcpTool<{ preview: string }>(page, 'read_filesystem_properties', {
    targetType: 'workspace-file',
    path: 'AGENTS.md',
  });

  expect(updatedFile.preview).toBe('# Updated\nKeep this synced through refs.');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/session-fs-workspace-reference.png', fullPage: true });
});

test('captures the active and completed reasoning activity flow', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  const faviconSvg = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"%3E%3Crect width="16" height="16" rx="4" fill="%238fd7ff"/%3E%3C/svg%3E';
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.evaluate((favicon) => {
    const main = document.querySelector('.shared-console-main');
    const messageList = document.querySelector('.message-list');
    if (!(main instanceof HTMLElement) || !(messageList instanceof HTMLElement)) {
      throw new Error('Chat layout missing');
    }

    messageList.innerHTML = `
      <div class="message user">
        <div class="message-sender message-sender-user"><span class="sender-name">you</span></div>
        <div class="message-bubble">Explain the shift toward runtime intelligence.</div>
      </div>
      <div class="message assistant">
        <div class="message-sender message-sender-agent"><span class="sender-name">gpt-4.1</span></div>
        <div class="op-trigger-block">
          <button type="button" class="op-trigger op-trigger-active reasoning-pill-thinking">
            <span>Thinking\u2026</span>
          </button>
        </div>
      </div>`;

    const existingPane = main.querySelector('.op-pane');
    existingPane?.remove();
    main.insertAdjacentHTML('beforeend', `
      <aside class="op-pane" aria-label="Activity panel">
        <header class="op-pane-header">
          <button type="button" class="op-pane-back" aria-label="Back to chat">&#8592;</button>
          <div class="op-pane-title">Thoughts</div>
          <span class="op-pane-duration">4s</span>
        </header>
        <div class="op-pane-body">
          <div class="op-timeline">
            <div class="op-timeline-item op-timeline-item-done">
              <span class="op-timeline-rail" aria-hidden="true"></span>
              <span class="op-timeline-dot" aria-hidden="true"></span>
              <div class="op-timeline-content">
                <div class="op-timeline-title-row"><strong>Pulling together current sources</strong></div>
                <p>I am pulling together current sources so the response stays grounded in what changed.</p>
              </div>
            </div>
            <div class="op-timeline-item op-timeline-item-active">
              <span class="op-timeline-rail" aria-hidden="true"></span>
              <span class="op-timeline-dot" aria-hidden="true"></span>
              <div class="op-timeline-content">
                <div class="op-timeline-title-row"><strong>Looking up benchmark lines on openreview.net</strong></div>
                <div class="op-source-row">
                  <span class="op-source-chip"><img src="${favicon}" alt="" aria-hidden="true" width="14" height="14" /><span>openreview.net</span></span>
                  <span class="op-source-chip"><img src="${favicon}" alt="" aria-hidden="true" width="14" height="14" /><span>cdn.openai.com</span></span>
                  <span class="op-source-chip op-source-chip-more">1 more</span>
                </div>
                <p>Checking benchmark lines against system card evidence.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>`);
  }, faviconSvg);

  await expect(page.getByRole('complementary', { name: 'Activity panel' })).toBeVisible();
  await expect(page.locator('.op-pane .op-timeline-item-active .op-timeline-title-row strong')).toHaveText('Looking up benchmark lines on openreview.net');
  await page.screenshot({ path: 'docs/screenshots/thinking-activity-active.png', fullPage: true });

  await page.evaluate((favicon) => {
    const messageList = document.querySelector('.message-list');
    const opPaneBody = document.querySelector('.op-pane-body');
    if (!(messageList instanceof HTMLElement) || !(opPaneBody instanceof HTMLElement)) {
      throw new Error('Reasoning surfaces missing');
    }

    messageList.innerHTML = `
      <div class="message user">
        <div class="message-sender message-sender-user"><span class="sender-name">you</span></div>
        <div class="message-bubble">Explain the shift toward runtime intelligence.</div>
      </div>
      <div class="message assistant">
        <div class="message-sender message-sender-agent"><span class="sender-name">gpt-4.1</span></div>
        <div class="op-trigger-block">
          <button type="button" class="op-trigger" aria-label="Thought for 1m 4s">
            <span>Thought for 1m 4s</span>
            <span class="op-trigger-chevron">&#8964;</span>
          </button>
        </div>
        <div class="message-bubble">Runtime intelligence is moving into the loop.</div>
      </div>`;

    opPaneBody.innerHTML = `
      <div class="op-timeline">
        <div class="op-timeline-item op-timeline-item-done">
          <span class="op-timeline-rail" aria-hidden="true"></span>
          <span class="op-timeline-dot" aria-hidden="true"></span>
          <div class="op-timeline-content">
            <div class="op-timeline-title-row"><strong>Pulling together current sources</strong></div>
            <p>I am pulling together current sources so the response stays grounded in what changed.</p>
          </div>
        </div>
        <div class="op-timeline-item op-timeline-item-done">
          <span class="op-timeline-rail" aria-hidden="true"></span>
          <span class="op-timeline-dot" aria-hidden="true"></span>
          <div class="op-timeline-content">
            <div class="op-timeline-title-row"><strong>Looking up benchmark lines on openreview.net</strong></div>
            <div class="op-source-row">
              <span class="op-source-chip"><img src="${favicon}" alt="" aria-hidden="true" width="14" height="14" /><span>openreview.net</span></span>
              <span class="op-source-chip"><img src="${favicon}" alt="" aria-hidden="true" width="14" height="14" /><span>cdn.openai.com</span></span>
              <span class="op-source-chip op-source-chip-more">1 more</span>
            </div>
            <p>Checking benchmark lines against system card evidence.</p>
          </div>
        </div>
      </div>`;

    const opPane = document.querySelector('.op-pane');
    if (opPane && !opPane.querySelector('.op-pane-footer')) {
      opPane.insertAdjacentHTML('beforeend', '<footer class="op-pane-footer"><span>Thought for 1m 4s</span><span>Done</span></footer>');
    }
    const durationEl = opPane?.querySelector('.op-pane-duration');
    if (durationEl instanceof HTMLElement) durationEl.textContent = '1m 4s';
  }, faviconSvg);

  await expect(page.getByText('Runtime intelligence is moving into the loop.')).toBeVisible();
  await expect(page.locator('.op-pane .op-source-chip span').first()).toHaveText('openreview.net');
  await page.screenshot({ path: 'docs/screenshots/thinking-activity-complete.png', fullPage: true });

  // Phase 3: close the overlay — show the inline pill in context
  await page.evaluate(() => {
    document.querySelector('.op-pane')?.remove();
  });

  await expect(page.getByRole('button', { name: /Thought for 1m 4s/i })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/thinking-inline-pill.png', fullPage: true });
  assertNoRuntimeErrors();
});

test('captures a sandbox tool run and persists generated files', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.addInitScript((storageKey: string) => {
    if (window.top !== window) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        VITE_SECURE_BROWSER_SANDBOX_EXEC: 'true',
      }));
    } catch {
      // Ignore frames that intentionally do not expose storage.
    }
  }, SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY);
  await page.goto('/');

  await expect(page.getByLabel('Chat input')).toBeVisible();
  await page.getByLabel('Chat input').fill([
    '/sandbox node index.js',
    'capture: dist/out.txt',
    'persist: /workspace/generated',
    '',
    '```js file=index.js',
    "console.log('hello from sandbox')",
    '```',
  ].join('\n'));
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText(/Sandbox run succeeded/i)).toBeVisible({ timeout: 10000 });
  const sandboxTranscriptEntry = page.locator('.message-bubble').filter({ hasText: 'saved files:' }).last();
  await expect(sandboxTranscriptEntry).toContainText('/workspace/generated/dist/out.txt');

  await switchToTerminalMode(page);
  const bashInput = page.getByLabel('Bash input');
  await expect(bashInput).toBeVisible();
  await bashInput.fill('cat /workspace/generated/dist/out.txt');
  await bashInput.press('Enter');
  await expect(bashInput).toBeEnabled({ timeout: 10000 });
  await expect(page.getByLabel('Terminal output')).toContainText('hello from sandbox');

  await page.evaluate((storageKey: string) => {
    window.localStorage.removeItem(storageKey);
  }, SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY);

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/sandbox-tool-run.png', fullPage: true });
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
  const shortcutsDialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(shortcutsDialog).toBeVisible();
  await expect(shortcutsDialog.getByText('Ctrl+Alt+←/→', { exact: true })).toBeVisible();
  await expect(shortcutsDialog.getByText('Alt+1-5', { exact: true })).toBeVisible();
  await expect(shortcutsDialog.getByText('Ctrl/Cmd+`', { exact: true })).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/keyboard-shortcuts.png', fullPage: true });
});

test('supports power-user navigation shortcuts across panels and modes', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Omnibar').waitFor();

  await page.keyboard.press('Alt+4');
  await expect(page.getByLabel('Hugging Face search')).toBeVisible();

  await page.keyboard.press('Alt+2');
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();

  await page.keyboard.press('Alt+1');
  await expect(page.getByLabel('Workspace tree')).toBeVisible();

  await page.keyboard.press('Control+Backquote');
  await expect(page.getByRole('heading', { name: 'Terminal' })).toBeVisible();

  await page.keyboard.press('Control+Backquote');
  await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();

  assertNoRuntimeErrors();
});

test('lets keyboard navigation enter category contents and wrap workspace cycling', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Workspace tree').waitFor();

  await page.keyboard.press('Home');
  await expect(page.locator('.tree-row.cursor .tree-button').first()).toContainText('Browser');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tree-row.cursor .tree-button').first()).toContainText('Hugging Face');

  await page.keyboard.press('Control+Alt+ArrowLeft');
  await expect(page.getByLabel('Toggle workspace overlay')).toHaveAttribute('title', 'Build');

  await page.keyboard.press('Control+Alt+ArrowRight');
  await expect(page.getByLabel('Toggle workspace overlay')).toHaveAttribute('title', 'Research');

  assertNoRuntimeErrors();
});

test('restores page overlays when switching back to a workspace', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Workspace tree').waitFor();

  await page.getByRole('button', { name: /Hugging Face/ }).first().click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(page.getByLabel('Address')).toHaveValue('https://huggingface.co/models?library=transformers.js');

  await page.keyboard.press('Control+2');
  await expect(page.getByRole('button', { name: /CopilotKit docs/ }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeHidden();

  await page.getByRole('button', { name: /CopilotKit docs/ }).first().click();
  await expect(page.getByLabel('Address')).toHaveValue('https://docs.copilotkit.ai');

  await page.keyboard.press('Control+1');
  await expect(page.getByLabel('Address')).toHaveValue('https://huggingface.co/models?library=transformers.js');

  await page.keyboard.press('Control+2');
  await expect(page.getByLabel('Address')).toHaveValue('https://docs.copilotkit.ai');

  assertNoRuntimeErrors();
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

test('captures omnibar search drafting into the chat composer', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Omnibar').fill('browser sandbox constraints');
  await page.getByLabel('Omnibar').press('Enter');

  await expect(page.getByLabel('Chat input')).toHaveValue('Search the web for: browser sandbox constraints');
  await expect(page.getByText('Search the web for: browser sandbox constraints', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/omnibar-search-draft.png', fullPage: true });
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
  await expect(page.getByRole('region', { name: 'File editor' }).locator('.file-editor-path-text')).toHaveText('.agents/hooks/test-hook.sh');
  // Edit the content
  await page.getByLabel('Workspace file content').fill('{"name": "test-hook", "version": "1.0"}');
  // Save the file (force click past any CopilotKit error overlay)
  await page.getByRole('button', { name: 'Save file' }).click({ force: true });
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-file-edit.png', fullPage: true });
});

// ── User flow: just-bash TUI panel ────────────────────────────────────

test('captures the chat/terminal tab switching UX', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // The panel starts in Chat mode
  await expect(page.getByLabel('Chat panel')).toBeVisible();
  const chatTab = page.getByRole('tab', { name: 'Chat mode' });
  const termTab = page.getByRole('tab', { name: 'Terminal mode' });
  await expect(chatTab).toBeVisible();
  await expect(termTab).toBeVisible();
  await expect(chatTab).toHaveAttribute('aria-selected', 'true');
  await expect(termTab).toHaveAttribute('aria-selected', 'false');

  // Chat content visible, terminal content hidden
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await expect(page.getByLabel('Bash input')).not.toBeVisible();

  // Switch to terminal mode
  await switchToTerminalMode(page);
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();
  await expect(termTab).toHaveAttribute('aria-selected', 'true');
  await expect(chatTab).toHaveAttribute('aria-selected', 'false');

  // Terminal content visible, chat content hidden
  await expect(page.getByLabel('Bash input')).toBeVisible();
  await expect(page.getByLabel('Chat input')).not.toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/just-bash-open.png', fullPage: true });

  // Switch back to chat mode
  await switchToChatMode(page);
  await expect(page.getByLabel('Chat panel')).toBeVisible();
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await expect(page.getByLabel('Bash input')).not.toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/just-bash-closed.png', fullPage: true });
});

test('terminal auto-focuses bash input on switch', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // Switch to terminal mode
  await switchToTerminalMode(page);
  await expect(page.getByLabel('Bash input')).toBeVisible();

  // The bash input should be auto-focused
  await expect(page.getByLabel('Bash input')).toBeFocused();

  assertNoRuntimeErrors();
});

test('terminal refocuses input after command execution', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // Switch to terminal mode
  await switchToTerminalMode(page);
  const bashInput = page.getByLabel('Bash input');
  await expect(bashInput).toBeVisible();

  // Type and submit a command
  await bashInput.fill('echo hello world');
  await bashInput.press('Enter');

  // Wait for async just-bash execution to complete (input re-enabled)
  await expect(bashInput).toBeEnabled({ timeout: 10000 });

  // Input should be auto-refocused after execution
  await expect(bashInput).toBeFocused();

  // Output should appear
  await expect(page.getByLabel('Terminal output')).toContainText('hello world');

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/just-bash-command.png', fullPage: true });
});

test('captures just-bash TUI pwd command', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  await switchToTerminalMode(page);
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();

  const bashInput = page.getByLabel('Bash input');
  await bashInput.fill('pwd');
  await bashInput.press('Enter');

  // Wait for async just-bash execution to complete
  await expect(bashInput).toBeEnabled({ timeout: 10000 });

  // pwd outputs the current working directory (/workspace)
  await expect(page.getByLabel('Terminal output')).toContainText('pwd');
  await expect(page.getByLabel('Terminal output')).toContainText('/workspace');

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/just-bash-pwd.png', fullPage: true });
});

test('captures just-bash TUI clear command', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  await switchToTerminalMode(page);
  const bashInput = page.getByLabel('Bash input');

  // Run a command via just-bash
  await bashInput.fill('echo before clear');
  await bashInput.press('Enter');
  await expect(bashInput).toBeEnabled({ timeout: 10000 });
  await expect(page.getByLabel('Terminal output')).toContainText('before clear');

  // Run clear (handled in-app, clears history without going through just-bash)
  await bashInput.fill('clear');
  await bashInput.press('Enter');
  await expect(page.getByLabel('Terminal output')).not.toContainText('before clear');

  // Input should be refocused after clear
  await expect(bashInput).toBeFocused();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/just-bash-clear.png', fullPage: true });
});

test('terminal shows welcome message when empty', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // Switch to terminal mode
  await switchToTerminalMode(page);
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();

  // Welcome message should be visible
  await expect(page.getByLabel('Terminal output')).toContainText('Welcome to just-bash');
  await expect(page.getByLabel('Terminal output')).toContainText('sandboxed shell');

  assertNoRuntimeErrors();
});

// ── User flow: switching workspaces ───────────────────────────────────

test('captures workspace switching via hotkeys', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Verify we start on the Research workspace by checking its seeded tab
  await expect(page.getByRole('button', { name: /Hugging Face/ }).first()).toBeVisible();
  // Use the target workspace hotkey to switch
  await page.keyboard.press('Control+Alt+ArrowRight');
  // The workspace tree should update (Build workspace has CopilotKit docs tab)
  await expect(page.getByRole('button', { name: /CopilotKit docs/ }).first()).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-switch.png', fullPage: true });
});

// ── Integration: gpt-2 model installation ─────────────────────────────
//
// These tests use addInitScript to override window.fetch before module init,
// which is the only reliable way to intercept cross-origin HF API calls in
// this preview-server environment.  The inference worker is intercepted via
// page.route() so the Worker constructor is never overridden (which would
// cause a blank page render in headless Chromium).

/** Minimal stub script served in place of the real browserInference worker. */
const WORKER_STUB = `
  self.onmessage = function(e) {
    var action = e.data.action;
    var id = e.data.id;
    if (action === 'load') {
      postMessage({ type: 'status', phase: 'model', id: id, msg: 'Loading\u2026', pct: null });
      setTimeout(function() { postMessage({ type: 'done', id: id, result: { loaded: true } }); }, 80);
    } else if (action === 'generate') {
      postMessage({ type: 'phase', id: id, phase: 'thinking' });
      postMessage({ type: 'phase', id: id, phase: 'generating' });
      postMessage({ type: 'token', id: id, token: 'Hi' });
      postMessage({ type: 'done', id: id, result: { text: 'Hi' } });
    }
  };
`;

const GPT2_ENTRY = {
  id: 'openai-community/gpt2',
  pipeline_tag: 'text-generation',
  downloads: 1234567,
  likes: 5678,
  tags: ['transformers.js', 'onnx', 'text-generation'],
  siblings: [
    { rfilename: 'config.json' },
    { rfilename: 'tokenizer.json' },
    { rfilename: 'onnx/model.onnx' },
    { rfilename: 'onnx/model_quantized.onnx' },
  ],
};

/** Simulated gated model: no ONNX siblings → would cause console.error in old code. */
const GATED_ENTRY = {
  id: 'pyannote/speaker-diarization-3.1',
  pipeline_tag: 'audio-classification',
  downloads: 5000,
  likes: 200,
  tags: ['transformers.js', 'onnx'],
  siblings: [], // no ONNX siblings visible; dtype probe will fail with 401
};

/**
 * Adds an addInitScript that overrides window.fetch to mock:
 * - HF model search API → returns GPT-2 + optionally a gated model
 * - Any HF dtype-probing request for gated model → 401
 */
async function mockHFApi(page: Page, entries: unknown[]) {
  await page.addInitScript((payload: string) => {
    const orig = window.fetch.bind(window);
    (window as unknown as Record<string, unknown>).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input
        : input instanceof Request ? input.url
        : String(input);
      if (url.includes('huggingface.co/api/models')) {
        return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Gated model config.json → 401 (simulates auth-gated HF repos)
      if (url.includes('pyannote') && url.includes('config.json')) {
        return new Response('', { status: 401 });
      }
      return orig(input, init);
    };
  }, JSON.stringify(entries));
}

test('settings: gated models are silently excluded without console.error', async ({ page }) => {
  // This test PREVIOUSLY FAILED because the old code called console.error(
  // "Failed to resolve browser dtypes for pyannote/speaker-diarization-3.1")
  // for each gated model whose config.json returned 401.
  // After the siblings-first fix, gated models with no ONNX siblings are
  // silently excluded — no console.error fires.
  const appErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
      appErrors.push(msg.text());
    }
  });

  // Return both gpt-2 (has ONNX siblings) and a gated model (no ONNX siblings)
  await mockHFApi(page, [GPT2_ENTRY, GATED_ENTRY]);

  await page.goto('/');
  await page.getByLabel('Settings').click();

  // Open the Registry section (collapsed by default when no search is active)
  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toBeVisible({ timeout: 5000 });
  await registryToggle.click();

  // gpt-2 resolves via fast-path (ONNX siblings); gated model → silently null
  await expect(page.getByRole('button', { name: /gpt2/i }).first()).toBeVisible({ timeout: 8000 });

  // No application-level console.error should appear for the gated model
  expect(appErrors, `Unexpected console errors:\n${appErrors.join('\n')}`).toEqual([]);

  await page.screenshot({ path: 'docs/screenshots/settings-model-list.png' });
});

test('installs gpt-2 and shows Installed state without console errors', async ({ page }) => {
  const appErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
      appErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => appErrors.push(`pageerror: ${error.message}`));

  // Replace the Worker constructor before app JS runs so the inference worker
  // is fully stubbed without depending on Vite's dev vs prod URL shape.
  await page.addInitScript(() => {
    const OriginalWorker = globalThis.Worker;
    function MockInferenceWorker(this: { onmessage: null | ((e: {data: unknown}) => void); onerror: null | (() => void) }) {
      this.onmessage = null;
      this.onerror = null;
    }
    MockInferenceWorker.prototype.postMessage = function(data: {action: string; id: string}) {
      const { action, id } = data || {};
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      if (action === 'load') {
        setTimeout(function() {
          self.onmessage?.({ data: { type: 'status', phase: 'model', id, msg: 'Loading\u2026', pct: null } });
          setTimeout(function() {
            self.onmessage?.({ data: { type: 'done', id, result: { loaded: true } } });
          }, 80);
        }, 0);
      } else if (action === 'generate') {
        setTimeout(function() {
          self.onmessage?.({ data: { type: 'token', id, token: 'Hi' } });
          self.onmessage?.({ data: { type: 'done', id, result: { text: 'Hi' } } });
        }, 80);
      }
    };
    MockInferenceWorker.prototype.terminate = function() {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker = function(url: unknown, opts: unknown) {
      if (String(url).includes('browserInference')) return new (MockInferenceWorker as unknown as new() => unknown)();
      return new OriginalWorker(url as string | URL, opts as WorkerOptions);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker.prototype = OriginalWorker.prototype;
  });

  // Override window.fetch to mock the HF API (cross-origin; page.route() does not
  // reliably intercept these in the preview-server environment).
  await mockHFApi(page, [GPT2_ENTRY]);

  await page.goto('/');
  await page.getByLabel('Settings').click();

  // Open the Registry section (collapsed by default when no search is active)
  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toBeVisible({ timeout: 5000 });
  await registryToggle.click();

  // Wait for gpt-2 to appear (siblings-fast-path; no dtype probe needed)
  const modelButton = page.getByRole('button', { name: /gpt2/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });

  // Click Load — the stub worker resolves in ~80ms
  await modelButton.click();

  // After install, the model card shows an "Installed" badge (the Load button is replaced)
  await expect(page.getByText('Installed').first()).toBeVisible({ timeout: 8000 });

  expect(appErrors, `Errors during gpt-2 install:\n${appErrors.join('\n')}`).toEqual([]);

  await page.screenshot({ path: 'docs/screenshots/gpt2-installed.png' });
});

test('falls back to staged tool pipeline + chat for delegation prompts on local Codi', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);

  const qwenEntry = {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    pipeline_tag: 'text-generation',
    downloads: 5000,
    likes: 30,
    tags: ['transformers.js', 'onnx', 'text-generation'],
    siblings: [
      { rfilename: 'config.json' },
      { rfilename: 'tokenizer.json' },
      { rfilename: 'onnx/model.onnx' },
    ],
  };

  await mockHFApi(page, [qwenEntry]);
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests = [];
    const OriginalWorker = globalThis.Worker;
    function MockInferenceWorker(this: { onmessage: null | ((e: { data: unknown }) => void); onerror: null | (() => void) }) {
      this.onmessage = null;
      this.onerror = null;
    }
    MockInferenceWorker.prototype.postMessage = function(data: { action?: string; id?: string; prompt?: unknown; options?: Record<string, unknown> }) {
      const { action, id = '', prompt, options } = data || {};
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      if (!id) return;

      const promptText = JSON.stringify(prompt || '');

      const decodePrompt = () => promptText.replace(/\\n/g, '\n').replace(/\\"/g, '"');

      const extractListedIds = (label: string) => {
        const decoded = decodePrompt();
        const sectionIndex = decoded.indexOf(label);
        if (sectionIndex === -1) return [] as string[];
        const section = decoded.slice(sectionIndex);
        const matches = section.matchAll(/-\s+([a-z0-9_-]+)\s*\(/gi);
        return Array.from(matches, (match) => match[1]).filter(Boolean);
      };

      const extractCatalogToolIds = () => {
        const decoded = decodePrompt();
        const matches = decoded.matchAll(/-\s+([a-z0-9_-]+):\s/gi);
        return Array.from(matches, (match) => match[1]).filter(Boolean);
      };

      if (action === 'load') {
        setTimeout(function() {
          self.onmessage?.({ data: { type: 'status', phase: 'model', id, msg: 'Loading…', pct: null } });
          setTimeout(function() {
            self.onmessage?.({ data: { type: 'done', id, result: { loaded: true } } });
          }, 80);
        }, 0);
        return;
      }

      if (action !== 'generate') {
        return;
      }

      (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests?.push({
        prompt,
        options: options ?? {},
      });

      const send = (text: string) => {
        self.onmessage?.({ data: { type: 'phase', id, phase: 'thinking' } });
        self.onmessage?.({ data: { type: 'phase', id, phase: 'generating' } });
        self.onmessage?.({ data: { type: 'token', id, token: text } });
        self.onmessage?.({ data: { type: 'done', id, result: { text } } });
      };

      setTimeout(function() {
        if (promptText.includes('Respond with JSON only: {"mode":"tool-use"|"chat","goal":"<short goal>"}')) {
          send(JSON.stringify({
            mode: 'tool-use',
            goal: 'Audit coverage health across the self-contained libraries.',
          }));
          return;
        }

        if (promptText.includes('Respond with JSON only: {"groups":["<group-id>"],"goal":"<short goal>"}')) {
          const groups = extractListedIds('Available groups:').slice(0, 2);
          send(JSON.stringify({
            groups,
            goal: 'Audit coverage health across the self-contained libraries.',
          }));
          return;
        }

        if (promptText.includes('Respond with JSON only: {"toolIds":["<tool-id>"],"goal":"<short goal>"}')) {
          const toolIds = extractListedIds('Available tools:').slice(0, 2);
          send(JSON.stringify({
            toolIds,
            goal: 'Audit coverage health across the self-contained libraries.',
          }));
          return;
        }

        if (promptText.includes('delegation-worker:task-planner') || promptText.includes('Plan the work as executable tasks.')) {
          const toolIds = extractCatalogToolIds();
          send(JSON.stringify({
            goal: 'Audit coverage health across the self-contained libraries.',
            tasks: [
              {
                id: 'collect-coverage-signals',
                title: 'Collect coverage signals',
                description: 'Use the selected tools to inspect the current coverage state and summarize the result.',
                toolIds: toolIds.slice(0, Math.min(2, toolIds.length)),
                toolRationale: 'Need lightweight inspection plus one execution surface to validate the workflow path.',
                dependsOn: [],
                validations: [
                  {
                    id: 'mock-output',
                    kind: 'response-contains',
                    substrings: ['Completed the requested step without timing out.'],
                  },
                ],
              },
            ],
          }));
          return;
        }

        if (promptText.includes('===PROBLEM===') && promptText.includes('===BREAKDOWN===')) {
          send([
            '<think>internal planning should stay hidden</think>',
            '===PROBLEM===',
            'Audit coverage health across the self-contained libraries.',
            '===BREAKDOWN===',
            '- Run coverage for each independent library track.',
            '- Capture pass/fail and per-metric coverage values.',
            '- Merge the results into one consolidated report.',
            '===ASSIGNMENT===',
            '- Role: Coverage specialist A | Owns: Run coverage for each independent library track across lib/inbrowser-use and lib/logact | Handoff: Coverage specialist B',
            '- Role: Coverage specialist B | Owns: Capture pass/fail and per-metric coverage values for lib/agent-browser-mcp and lib/webmcp | Handoff: Aggregation specialist',
            '- Role: Aggregation specialist | Owns: Merge the results into one consolidated report and flag any threshold gaps | Handoff: final report',
            '===VALIDATION===',
            '- Verify that all four libraries are represented exactly once.',
            '- Flag any metric that falls below the configured threshold.',
          ].join('\n'));
          return;
        }

        if (promptText.includes('delegation-worker:sectioned-plan')) {
          send([
            '===PROBLEM===',
            'Audit coverage health across the self-contained libraries.',
            '===BREAKDOWN===',
            '- Run coverage for each independent library track.',
            '- Capture pass/fail and per-metric coverage values.',
            '- Merge the results into one consolidated report.',
            '===ASSIGNMENT===',
            '- Role: Coverage specialist A | Owns: Run coverage for each independent library track across lib/inbrowser-use and lib/logact | Handoff: Coverage specialist B',
            '- Role: Coverage specialist B | Owns: Capture pass/fail and per-metric coverage values for lib/agent-browser-mcp and lib/webmcp | Handoff: Aggregation specialist',
            '- Role: Aggregation specialist | Owns: Merge the results into one consolidated report and flag any threshold gaps | Handoff: final report',
            '===VALIDATION===',
            '- Verify that all four libraries are represented exactly once.',
            '- Flag any metric that falls below the configured threshold.',
          ].join('\n'));
          return;
        }

        // Local executor turn: first turn emits a JSON tool call so the
        // staged pipeline actually exercises tool calling on local models;
        // the second turn (which sees a <tool_result> in the conversation)
        // returns the final answer.
        if (promptText.includes('<tool_result')) {
          send('Completed the requested step without timing out.');
          return;
        }

        const catalogIds = extractCatalogToolIds();
        const firstTool = catalogIds[0];
        if (firstTool) {
          send(`<tool_call>${JSON.stringify({ tool: firstTool, args: {} })}</tool_call>`);
          return;
        }

        send('Completed the requested step without timing out.');
      }, 20);
    };
    MockInferenceWorker.prototype.terminate = function() {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker = function(url: unknown, opts: unknown) {
      if (String(url).includes('browserInference')) return new (MockInferenceWorker as unknown as new() => unknown)();
      return new OriginalWorker(url as string | URL, opts as WorkerOptions);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker.prototype = OriginalWorker.prototype;
  });

  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.getByLabel('Settings').click();
  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toBeVisible({ timeout: 5000 });
  await registryToggle.click();
  const modelButton = page.getByRole('button', { name: /Qwen3-0.6B-ONNX/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });
  await modelButton.click();
  await expect(page.getByText('Installed').first()).toBeVisible({ timeout: 8000 });

  await page.getByLabel('Workspaces').click();
  await page.locator('select[aria-label="Agent provider"]').selectOption('codi');
  const prompt = 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents.';
  await page.getByLabel('Chat input').fill(prompt);
  await page.getByRole('button', { name: 'Send' }).click();

  // The active provider is local Codi. Local models cannot reliably drive the
  // multi-stage delegation pipeline (every stage stalls on Qwen3-0.6B), so
  // delegation prompts must fall back to the staged tool pipeline + chat path
  // and produce a real response without firing the planning watchdog.
  await expect(page.getByText('Completed the requested step without timing out.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Local tool planning stalled/i)).toHaveCount(0);
  await expect(page.getByText(/timed out/i)).toHaveCount(0);
  // Delegation-only UI must not render for the local-model fallback path.
  await expect(page.getByText('Parallel delegation plan')).toHaveCount(0);
  await expect(page.getByText('Subagent breakdown')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('<think>');

  const workerGenerateRequests = await page.evaluate(() => {
    return (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests ?? [];
  });
  // Fallback path must have driven multiple staged-pipeline calls
  // (router + chat or executor) instead of a single one-shot request.
  expect(workerGenerateRequests.length).toBeGreaterThanOrEqual(2);
  // Qwen3 thinking must remain disabled on every request or stages spend
  // their entire token budget inside `<think>...</think>` and the idle
  // watchdog fires before any visible output appears.
  for (const request of workerGenerateRequests) {
    expect((request as { options?: { enable_thinking?: boolean } }).options?.enable_thinking).toBe(false);
  }

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/parallel-delegation-workflow.png', fullPage: true });
});

test('Qwen3 direct-chat routing uses memory and coding guidance for local Codi prompts', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  const qwenEntry = {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    name: 'Qwen3-0.6B-ONNX',
    author: 'onnx-community',
    pipeline_tag: 'text-generation',
    tags: ['transformers.js', 'onnx', 'text-generation'],
    downloads: 5000,
    likes: 30,
    siblings: [
      { rfilename: 'config.json' },
      { rfilename: 'tokenizer.json' },
      { rfilename: 'onnx/model.onnx' },
    ],
  };

  await mockHFApi(page, [qwenEntry]);
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests = [];
    const OriginalWorker = globalThis.Worker;
    function MockInferenceWorker(this: { onmessage: null | ((e: { data: unknown }) => void); onerror: null | (() => void) }) {
      this.onmessage = null;
      this.onerror = null;
    }
    MockInferenceWorker.prototype.postMessage = function(data: { action?: string; id?: string; prompt?: unknown; options?: Record<string, unknown> }) {
      const { action, id = '', prompt, options } = data || {};
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      if (!id) return;

      if (action === 'load') {
        setTimeout(function() {
          self.onmessage?.({ data: { type: 'status', phase: 'model', id, msg: 'Loading…', pct: null } });
          setTimeout(function() {
            self.onmessage?.({ data: { type: 'done', id, result: { loaded: true } } });
          }, 80);
        }, 0);
        return;
      }

      if (action !== 'generate') {
        return;
      }

      (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests?.push({
        prompt,
        options: options ?? {},
      });

      const promptText = JSON.stringify(prompt || '');
      const send = (text: string) => {
        self.onmessage?.({ data: { type: 'phase', id, phase: 'thinking' } });
        self.onmessage?.({ data: { type: 'phase', id, phase: 'generating' } });
        self.onmessage?.({ data: { type: 'token', id, token: text } });
        self.onmessage?.({ data: { type: 'done', id, result: { text } } });
      };

      setTimeout(function() {
        if (promptText.includes('Tool Routing Guidance')) {
          send('{"mode":"chat","goal":"answer directly"}');
          return;
        }
        if (promptText.includes('Memory / Recall Guidance')) {
          send('Saved a compact note and summarized the open question.');
          return;
        }
        if (promptText.includes('Coding Guidance')) {
          send('Planned the minimal fix and a focused vitest run.');
          return;
        }
        send('Fallback local answer.');
      }, 20);
    };
    MockInferenceWorker.prototype.terminate = function() {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker = function(url: unknown, opts: unknown) {
      if (String(url).includes('browserInference')) return new (MockInferenceWorker as unknown as new() => unknown)();
      return new OriginalWorker(url as string | URL, opts as WorkerOptions);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker.prototype = OriginalWorker.prototype;
  });

  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.getByLabel('Settings').click();
  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toBeVisible({ timeout: 5000 });
  await registryToggle.click();
  const modelButton = page.getByRole('button', { name: /Qwen3-0.6B-ONNX/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });
  await modelButton.click();
  await expect(page.getByText('Installed').first()).toBeVisible({ timeout: 8000 });

  await page.getByLabel('Workspaces').click();
  await page.locator('select[aria-label="Agent provider"]').selectOption('codi');

  await page.evaluate(() => {
    (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests = [];
  });
  await page.getByLabel('Chat input').fill('Please remember this note, summarize it, and keep track of the unresolved question.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Saved a compact note and summarized the open question.')).toBeVisible({ timeout: 15_000 });

  const memoryRequests = await page.evaluate(() => {
    return (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests ?? [];
  });
  expect(memoryRequests.some((request) => JSON.stringify(request.prompt ?? '').includes('Memory / Recall Guidance'))).toBe(true);

  await page.evaluate(() => {
    (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests = [];
  });
  await page.getByLabel('Chat input').fill('Fix the failing vitest run with the smallest safe code change.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Planned the minimal fix and a focused vitest run.')).toBeVisible({ timeout: 15_000 });

  const codingRequests = await page.evaluate(() => {
    return (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests ?? [];
  });
  expect(codingRequests.some((request) => JSON.stringify(request.prompt ?? '').includes('Coding Guidance'))).toBe(true);

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/codi-scenario-routing.png', fullPage: true });
});

test('Qwen3 staged tool pipeline plans and runs without the local tool watchdog firing', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);

  const qwenEntry = {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    pipeline_tag: 'text-generation',
    downloads: 5000,
    likes: 30,
    tags: ['transformers.js', 'onnx', 'text-generation'],
    siblings: [
      { rfilename: 'config.json' },
      { rfilename: 'tokenizer.json' },
      { rfilename: 'onnx/model.onnx' },
    ],
  };

  await mockHFApi(page, [qwenEntry]);
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests = [];
    const OriginalWorker = globalThis.Worker;
    function MockInferenceWorker(this: { onmessage: null | ((e: { data: unknown }) => void); onerror: null | (() => void) }) {
      this.onmessage = null;
      this.onerror = null;
    }
    MockInferenceWorker.prototype.postMessage = function(data: { action?: string; id?: string; prompt?: unknown; options?: Record<string, unknown> }) {
      const { action, id = '', prompt, options } = data || {};
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      if (!id) return;

      if (action === 'load') {
        setTimeout(function() {
          self.onmessage?.({ data: { type: 'status', phase: 'model', id, msg: 'Loading…', pct: null } });
          setTimeout(function() {
            self.onmessage?.({ data: { type: 'done', id, result: { loaded: true } } });
          }, 40);
        }, 0);
        return;
      }

      if (action !== 'generate') {
        return;
      }

      (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests?.push({
        prompt,
        options: options ?? {},
      });

      const promptText = JSON.stringify(prompt || '');
      const send = (text: string) => {
        self.onmessage?.({ data: { type: 'phase', id, phase: 'thinking' } });
        self.onmessage?.({ data: { type: 'phase', id, phase: 'generating' } });
        self.onmessage?.({ data: { type: 'token', id, token: text } });
        self.onmessage?.({ data: { type: 'done', id, result: { text } } });
      };

      setTimeout(function() {
        if (promptText.includes('Tool Routing Guidance')) {
          send('<think>deciding…</think>{"mode":"tool-use","goal":"list workspace files"}');
          return;
        }
        if (promptText.includes('Tool Group Selection Guidance')) {
          send('<think>grouping…</think>{"groups":["files-worktree-mcp"],"goal":"list workspace files"}');
          return;
        }
        if (promptText.includes('Tool Selection Guidance')) {
          send('<think>picking…</think>{"toolIds":["list_session_files"],"goal":"list workspace files"}');
          return;
        }
        // Executor turn — just answer directly; no actual tool call needed to
        // prove the pipeline ran to completion without the idle watchdog.
        send('Listed the workspace files.');
      }, 20);
    };
    MockInferenceWorker.prototype.terminate = function() {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker = function(url: unknown, opts: unknown) {
      if (String(url).includes('browserInference')) return new (MockInferenceWorker as unknown as new() => unknown)();
      return new OriginalWorker(url as string | URL, opts as WorkerOptions);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Worker.prototype = OriginalWorker.prototype;
  });

  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  await page.getByLabel('Settings').click();
  const registryToggle = page.locator('.settings-result-list .section-toggle');
  await expect(registryToggle).toBeVisible({ timeout: 5000 });
  await registryToggle.click();
  const modelButton = page.getByRole('button', { name: /Qwen3-0.6B-ONNX/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });
  await modelButton.click();
  await expect(page.getByText('Installed').first()).toBeVisible({ timeout: 8000 });

  await page.getByLabel('Workspaces').click();
  await page.locator('select[aria-label="Agent provider"]').selectOption('codi');
  await page.getByLabel('Chat input').fill('List files in the current workspace.');
  await page.getByRole('button', { name: 'Send' }).click();

  // The pipeline must reach the executor and produce the final answer without
  // the idle watchdog firing.
  await expect(page.getByText('Listed the workspace files.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Local tool planning (produced no output at all|is still thinking with no new visible output|stalled after output stopped)/i)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('<think>');

  const workerGenerateRequests = await page.evaluate(() => {
    return (globalThis as typeof globalThis & { __workerGenerateRequests?: Array<Record<string, unknown>> }).__workerGenerateRequests ?? [];
  });

  expect(workerGenerateRequests.length).toBeGreaterThanOrEqual(4);

  // Every staged planning call must have thinking disabled and use Qwen3's
  // recommended non-thinking sampling overrides.
  const planningRequests = workerGenerateRequests.filter((request) => {
    const prompt = JSON.stringify(request.prompt ?? '');
    return /Tool Routing Guidance|Tool Group Selection Guidance|Tool Selection Guidance/.test(prompt);
  });
  expect(planningRequests.length).toBeGreaterThanOrEqual(3);
  for (const request of planningRequests) {
    expect(request.options).toMatchObject({
      enable_thinking: false,
      top_k: 20,
      min_p: 0,
    });
    const prompt = JSON.stringify(request.prompt ?? '');
    expect(prompt).toContain('/no_think');
  }

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/qwen3-stages/qwen3-staged-tool-pipeline.png', fullPage: true });
});

// ── Regression: panel coexistence ─────────────────────────────────────

test('browser panel does not replace session panel when opened after a terminal session and file pane', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // Step 1: open a terminal session pane — switch the default session to terminal mode
  await switchToTerminalMode(page);
  await expect(page.getByRole('heading', { name: 'Terminal' })).toBeVisible();

  // Step 2: open a file pane — add AGENTS.md which opens the file editor
  await page.getByLabel('Add file to Research').click();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  await expect(page.getByLabel('File editor')).toBeVisible();
  // terminal session (Chat panel / Terminal) should still be visible alongside the file editor
  await expect(page.getByLabel('Terminal')).toBeVisible();

  // Step 3: open a browser panel pane — single-click Hugging Face
  await page.getByRole('button', { name: 'Hugging Face' }).first().click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();

  // All three panels must still be present in the split view
  await expect(page.getByLabel('File editor')).toBeVisible();
  await expect(page.getByLabel('Terminal')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/panel-coexistence-regression.png', fullPage: true });
});

test('file editor stays visible when a browser panel is added', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // Open the file editor
  await page.getByLabel('Add file to Research').click();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  await expect(page.getByLabel('File editor')).toBeVisible();

  // Now single-click a browser tab — should ADD it as a new pane, not replace the file editor
  await page.getByRole('button', { name: 'Hugging Face' }).first().click();

  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(page.getByLabel('File editor')).toBeVisible();
  // Both panels must exist in a split-view container
  await expect(page.locator('.browser-split-view')).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/file-browser-split-regression.png', fullPage: true });
});

test('session panel stays visible when a browser tab is opened', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  // The default session panel (Chat panel) is already active
  await expect(page.getByLabel('Chat panel')).toBeVisible();

  // Open a browser tab via single-click
  await page.getByRole('button', { name: 'Hugging Face' }).first().click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();

  // Session panel must still be visible alongside the browser panel
  await expect(page.getByLabel('Chat panel')).toBeVisible();
  await expect(page.locator('.browser-split-view')).toBeVisible();

  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/session-browser-coexistence-regression.png', fullPage: true });
});

test('title bar controls remain clickable while split panels are draggable', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  const fileEditorPanel = page.locator('section[aria-label="File editor"]');
  await page.goto('/');

  await page.getByLabel('Add file to Research').click();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  await expect(fileEditorPanel).toBeVisible();

  await page.getByRole('button', { name: 'Hugging Face' }).first().click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toBeVisible();
  await expect(page.locator('.panel-drag-cell')).toHaveCount(4);

  await page.getByRole('tab', { name: 'Terminal mode' }).click();
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();

  await page.getByRole('button', { name: 'Close page overlay' }).click();
  await expect(page.getByRole('region', { name: 'Page overlay' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Close file editor' }).click();
  await expect(fileEditorPanel).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();

  assertNoRuntimeErrors();
});
