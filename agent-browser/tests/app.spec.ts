import { expect, test, type Page } from '@playwright/test';

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

// ── Screen capture tests ──────────────────────────────────────────────

test('captures the main workspace screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByLabel('Omnibar')).toBeVisible();
  // The tree shows workspaces with tabs and a "+" button to add files
  await expect(page.getByLabel('Workspace tree')).toBeVisible();
  // Add a file via the "+" button on Research workspace
  await page.getByLabel('Add file to Research').click();
  await expect(page.getByRole('dialog', { name: 'Add file' })).toBeVisible();
  await page.getByRole('button', { name: 'AGENTS.md' }).click();
  // AGENTS.md should appear in the tree and open in the file editor
  await expect(page.getByLabel('Workspace file path')).toHaveValue('AGENTS.md');
  // Add a skill
  await page.getByLabel('Add file to Research').click();
  await page.getByLabel('Capability name').fill('review-pr');
  await page.getByRole('button', { name: 'Skill' }).click();
  await expect(page.getByLabel('Workspace file path')).toHaveValue('.agents/skill/review-pr/SKILL.md');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-screen.png', fullPage: true });
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

test('captures the settings screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByLabel('Hugging Face search')).toBeVisible();
  await expect(page.locator('.chip.active')).toHaveCount(0);
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/settings-screen.png', fullPage: true });
});

test('captures the extensions screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('Extensions').click();
  await expect(page.getByRole('heading', { name: 'Extensions' })).toBeVisible();
  await expect(page.getByLabel('Search extensions')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/extensions-screen.png', fullPage: true });
});

test('captures the history screen', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.getByLabel('History').click();
  await expect(page.getByText('Recent sessions')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/history-screen.png', fullPage: true });
});

// ── User flow: chat interaction ───────────────────────────────────────

test('captures the chat panel with composer', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByLabel('Chat input')).toBeVisible();
  await expect(page.getByText('Agent Chat')).toBeVisible();
  await expect(page.getByText('Workspace assistant', { exact: true })).toBeVisible();
  // Fill the composer to show the typing state
  await page.getByLabel('Chat input').fill('What local models are available?');
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/chat-composer.png', fullPage: true });
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
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await expect(page.getByText('Ctrl+Alt+←/→')).toBeVisible();
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/keyboard-shortcuts.png', fullPage: true });
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

// ── User flow: workspace file editing ─────────────────────────────────

test('captures workspace file edit and delete flow', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Add a file via the tree "+" button
  await page.getByLabel('Add file to Research').click();
  await page.getByLabel('Capability name').fill('test-hook');
  await page.getByRole('button', { name: 'Hook' }).click();
  // File editor opens in the content area
  await expect(page.getByLabel('Workspace file path')).toHaveValue('.agents/hooks/test-hook.sh');
  // Edit the content
  await page.getByLabel('Workspace file content').fill('{"name": "test-hook", "version": "1.0"}');
  // Save the file (force click past any CopilotKit error overlay)
  await page.getByRole('button', { name: 'Save file' }).click({ force: true });
  assertNoRuntimeErrors();
  await page.screenshot({ path: 'docs/screenshots/workspace-file-edit.png', fullPage: true });
});

// ── User flow: switching workspaces ───────────────────────────────────

test('captures workspace switching via hotkeys', async ({ page }) => {
  const assertNoRuntimeErrors = captureRuntimeErrors(page);
  await page.goto('/');
  // Verify we start on Research workspace by checking tree has Research tabs
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

  // Intercept the worker module script at the browser-context level so the stub
  // is served for ALL requests including those originating from a dedicated
  // web worker (page.route() only covers the page frame, not worker threads).
  await page.context().route(/\/assets\/browserInference\.worker[^/]*\.js/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: WORKER_STUB });
  });

  // Override window.fetch to mock the HF API (cross-origin; page.route() does not
  // reliably intercept these in the preview-server environment).
  await mockHFApi(page, [GPT2_ENTRY]);

  await page.goto('/');
  await page.getByLabel('Settings').click();

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
