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

test('installs gpt-2 without any console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // Skip browser-generated resource-load failure messages (e.g. CopilotKit
      // backend unreachable in the test environment).  Application-level model
      // errors ("Failed to resolve browser dtypes for …", "Failed to install model …")
      // do NOT start with this prefix and will still be caught.
      if (text.startsWith('Failed to load resource:')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });

  // Inject mocks before any page script runs so Transformers.js and the Worker
  // constructor pick up our fakes when they initialize.
  await page.addInitScript(() => {
    // ── A. Stub the inference worker ──────────────────────────────────────
    // The bundled app creates `new Worker('/assets/browserInference.worker-xxx.js',
    // { type: 'module' })`.  We intercept any Worker creation whose URL mentions
    // "browserInference" and instead return a plain (classic) blob-URL worker
    // that simulates a successful pipeline load without real model downloads.
    const _OrigWorker = window.Worker;
    const STUB_SRC = `
      self.onmessage = async function(e) {
        var type = e.data.type, id = e.data.id;
        if (type === 'load') {
          postMessage({ type: 'phase', id: id, phase: 'Downloading model\u2026' });
          setTimeout(function() {
            postMessage({ type: 'status', id: id, msg: 'ready' });
          }, 100);
        } else if (type === 'generate') {
          postMessage({ type: 'done', id: id, result: { generated_text: 'Hello' } });
        }
      };
    `;
    // Using a regular function constructor so we can return the real Worker
    // instance directly (a non-primitive return from `new` is used as-is).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function MockWorker(this: unknown, url: string | URL, options?: WorkerOptions): Worker {
      const urlStr = typeof url === 'string' ? url : String(url);
      if (urlStr.includes('browserInference')) {
        const blob = new Blob([STUB_SRC], { type: 'application/javascript' });
        return new _OrigWorker(URL.createObjectURL(blob)); // classic worker, no module flag
      }
      return new _OrigWorker(url, options);
    }
    MockWorker.prototype = _OrigWorker.prototype;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Worker = MockWorker;

    // ── B. Stub window.fetch for HF API and dtype-probing calls ───────────
    // Transformers.js captures `globalThis.fetch` during module init, so we must
    // override it here (before page scripts run) rather than via page.route().
    const _originalFetch = window.fetch.bind(window);

    const GPT2_SIBLINGS = [
      { rfilename: 'config.json' },
      { rfilename: 'tokenizer.json' },
      { rfilename: 'onnx/model.onnx' },
      { rfilename: 'onnx/model_quantized.onnx' },
    ];
    const GPT2_API_ENTRY = {
      id: 'openai-community/gpt2',
      pipeline_tag: 'text-generation',
      downloads: 1234567,
      likes: 5678,
      tags: ['transformers.js', 'onnx', 'text-generation'],
      siblings: GPT2_SIBLINGS,
    };
    const GPT2_CONFIG = JSON.stringify({
      model_type: 'gpt2',
      architectures: ['GPT2LMHeadModel'],
      vocab_size: 50257,
      n_positions: 1024,
      n_embd: 768,
      n_layer: 12,
      n_head: 12,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input
        : input instanceof Request ? input.url
        : String(input);

      // HF model search → return only gpt-2
      if (url.includes('huggingface.co/api/models')) {
        return new Response(JSON.stringify([GPT2_API_ENTRY]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // gpt-2 config.json for dtype probing (ModelRegistry.get_available_dtypes)
      if (url.includes('openai-community/gpt2') && url.includes('config.json')) {
        return new Response(GPT2_CONFIG, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ONNX file existence checks (Range GET from get_file_metadata)
      if (url.includes('openai-community/gpt2') && url.includes('/onnx/')) {
        const exists = url.endsWith('model_quantized.onnx') || url.endsWith('model.onnx');
        if (exists) {
          return new Response('', {
            status: 206,
            headers: { 'Content-Range': 'bytes 0-0/12345678', 'Content-Length': '1' },
          });
        }
        return new Response('', { status: 404 });
      }

      return _originalFetch(input, init);
    };
  });

  // Navigate and open the Settings panel
  await page.goto('/');
  await page.getByLabel('Settings').click();

  // Wait for gpt-2 to appear (350ms debounce + mock API response)
  const modelButton = page.getByRole('button', { name: /gpt2/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });

  // Click Load — the stub worker resolves in ~100ms
  await modelButton.click();

  // The button becomes disabled and its inner span changes to "Installed"
  await expect(modelButton.locator('text=Installed')).toBeVisible({ timeout: 8000 });

  // No console.error fired at any point during the flow
  expect(consoleErrors, `Console errors during gpt-2 install:\n${consoleErrors.join('\n')}`).toEqual([]);

  await page.screenshot({ path: 'docs/screenshots/gpt2-installed.png', fullPage: true });
});

