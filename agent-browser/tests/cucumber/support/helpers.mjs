import { expect } from '@playwright/test';

export const GPT2_ENTRY = {
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

const TAB_URLS = {
  'Hugging Face': 'https://huggingface.co/models?library=transformers.js',
  'CopilotKit docs': 'https://docs.copilotkit.ai',
};

export function buildInferenceWorkerStub() {
  return `
    self.onmessage = function(event) {
      var data = event.data || {};
      var id = data.id;
      if (data.action === 'load') {
        postMessage({ type: 'status', phase: 'model', id: id, msg: 'Loading...', pct: null });
        setTimeout(function() {
          postMessage({ type: 'done', id: id, result: { loaded: true, modelId: data.modelId } });
        }, 250);
        return;
      }
      if (data.action === 'generate') {
        var prompt = JSON.stringify(data.prompt || []);
        var hasWorkspaceContext = prompt.indexOf('Active workspace: Research') !== -1 || prompt.indexOf('Active workspace: Build') !== -1 || prompt.indexOf('Active workspace: Ops') !== -1 || prompt.indexOf('Active workspace: Workspace 3') !== -1;
        var response = 'model=' + String(data.modelId || '') + ';workspace=' + (hasWorkspaceContext ? 'present' : 'missing');
        postMessage({ type: 'phase', id: id, phase: 'thinking' });
        postMessage({ type: 'token', id: id, token: response });
        postMessage({ type: 'done', id: id, result: { text: response } });
      }
    };
  `;
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function basename(filePath) {
  return filePath.split('/').pop() ?? filePath;
}

export function modelFixtureByName(name) {
  if (name.toLowerCase() === 'gpt2') return GPT2_ENTRY;
  throw new Error(`No model fixture defined for ${name}`);
}

export function modelIdByName(name) {
  return modelFixtureByName(name).id;
}

export function urlForTabName(tabName) {
  const url = TAB_URLS[tabName];
  if (!url) throw new Error(`No URL mapping defined for tab ${tabName}`);
  return url;
}

export async function installRegistryMock(page) {
  await page.addInitScript(() => {
    window.__bddRegistryPayload = '[]';
    window.__bddRegistryRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      if (url.includes('huggingface.co/api/models')) {
        window.__bddRegistryRequests.push(url);
        return new Response(window.__bddRegistryPayload || '[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };
  });
}

export async function setRegistryEntries(page, entries) {
  await page.evaluate((payload) => {
    window.__bddRegistryPayload = payload;
  }, JSON.stringify(entries));
}

export async function getRegistryRequests(page) {
  return page.evaluate(() => window.__bddRegistryRequests.slice());
}

export function isCriticalConsoleError(text) {
  return [
    'Failed to load module script',
    'Expected a JavaScript module script',
    'Strict MIME type checking',
    'wasm module script',
    'Unexpected token',
  ].some((fragment) => text.includes(fragment));
}

export function isLocalUrl(url) {
  return url.startsWith('http://127.0.0.1:4173/') || url.startsWith('http://localhost:4173/');
}

export function isCriticalAssetUrl(url) {
  return /\.(?:js|mjs|css|wasm)(?:$|\?)/.test(url);
}

export function isIgnoredLocalUrl(url) {
  return url.endsWith('/favicon.ico') || url.includes('/copilotkit');
}

export async function openPanel(page, label) {
  await page.getByLabel(label).click();
}

export async function openWorkspaceSwitcher(page) {
  await page.getByLabel('Toggle workspace overlay').click();
  await expect(page.getByRole('dialog', { name: 'Workspace switcher' })).toBeVisible();
}

export async function closeWorkspaceSwitcher(page) {
  const dialog = page.getByRole('dialog', { name: 'Workspace switcher' });
  if (await dialog.count()) {
    await dialog.getByLabel('Close workspace switcher').click();
    await expect(dialog).toHaveCount(0);
  }
}

export async function switchWorkspace(page, workspaceName) {
  const workspacePill = page.getByLabel('Toggle workspace overlay');
  if (await workspacePill.textContent() && (await workspacePill.textContent()).includes(workspaceName)) {
    return;
  }

  await openWorkspaceSwitcher(page);
  const dialog = page.getByRole('dialog', { name: 'Workspace switcher' });
  await dialog.locator('.workspace-card-button').filter({ hasText: workspaceName }).first().click();
  await expect(workspacePill).toContainText(workspaceName);
}

export async function expectWorkspaceTree(page, workspaceName) {
  await expect(page.getByLabel(`Add file to ${workspaceName}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Files' }).first()).toBeVisible();
}

export async function ensureTerminalMode(page) {
  await page.getByRole('tab', { name: 'Terminal mode' }).click({ force: true });
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();
}

export async function runTerminalCommand(page, command) {
  const input = page.getByLabel('Bash input');
  await expect(input).toBeVisible();
  await input.fill(command);
  await input.press('Enter');
  await expect(input).toBeEnabled({ timeout: 10000 });
}

export async function addWorkspaceCapability(page, workspaceName, kind, name = '') {
  await page.getByLabel(`Add file to ${workspaceName}`).click();
  if (kind === 'AGENTS.md') {
    await page.getByRole('button', { name: 'AGENTS.md' }).click();
    return;
  }
  if (name) {
    await page.getByLabel('Capability name').fill(name);
  }
  await page.getByRole('button', { name: kind }).click();
}

export async function ensureWorkspaceFile(page, workspaceName, filePath) {
  const fileName = basename(filePath);
  if (await page.getByRole('button', { name: fileName, exact: true }).count()) {
    return;
  }

  if (filePath === 'AGENTS.md') {
    await addWorkspaceCapability(page, workspaceName, 'AGENTS.md');
    return;
  }

  const skillMatch = filePath.match(/^\.agents\/skill\/([^/]+)\/SKILL\.md$/);
  if (skillMatch) {
    await addWorkspaceCapability(page, workspaceName, 'Skill', skillMatch[1]);
    return;
  }

  const hookMatch = filePath.match(/^\.agents\/hooks\/([^/.]+)\.[^.]+$/);
  if (hookMatch) {
    await addWorkspaceCapability(page, workspaceName, 'Hook', hookMatch[1]);
    return;
  }

  throw new Error(`Unsupported workspace file path for setup: ${filePath}`);
}

export async function ensureSecondTerminalSession(page, workspaceName, sessionName) {
  if (await page.getByRole('button', { name: sessionName, exact: true }).count()) {
    return;
  }
  await page.getByLabel(`Add terminal to ${workspaceName}`).click();
  await expect(page.getByRole('button', { name: sessionName, exact: true })).toBeVisible();
}

export async function openTerminalSession(page, sessionName) {
  await page.getByRole('button', { name: sessionName, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Terminal' })).toBeVisible();
}

export async function openBrowserTab(page, tabName) {
  await page.getByRole('button', { name: new RegExp(escapeRegExp(tabName), 'i') }).first().click();
}

export async function installModelFromSettings(page, modelName) {
  const modelButton = page.getByRole('button', { name: new RegExp(escapeRegExp(modelName), 'i') }).first();
  await expect(modelButton).toBeVisible({ timeout: 8000 });
  await modelButton.click();
}