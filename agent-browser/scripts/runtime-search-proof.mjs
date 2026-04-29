import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { buildSearchEvalCases } from './generate-search-eval-cases.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(scriptPath), '..');
const repoRoot = path.resolve(packageRoot, '..');
const port = Number(process.env.AGENT_BROWSER_RUNTIME_PROOF_PORT) || 5174;
const baseURL = `http://127.0.0.1:${port}`;
const screenshotPath = path.resolve(
  repoRoot,
  process.env.AGENT_BROWSER_RUNTIME_PROOF_SCREENSHOT
    ?? 'output/playwright/agent-browser-runtime-search-proof.png',
);

const BAD_LABELS = [
  'Moviefone TV',
  'Sign In/Join',
  'FanClub',
  'Fandango Ticketing Theaters My',
  'Featured Movie Animal Farm',
  'Movie Showimes',
  'IL 60004 Update Zipcode Monday',
  'At Home',
  'Movie Charts',
  'Movie News',
  'Movies',
  'Theaters',
  'TV Shows',
  'FanStore',
  'Streaming',
  'Coming Soon',
  'Skip to Main Content',
];

const EXPECTED_THEATERS = [
  'AMC Randhurst 12',
  'CMX Arlington Heights',
  'Classic Cinemas Elk Grove Theatre',
];

function fixtureContract() {
  const testCase = buildSearchEvalCases()
    .find((candidate) => candidate.id === 'negative-movie-theaters-moviefone-page-chrome');
  if (!testCase?.expected_output) {
    throw new Error('Missing movie theater bad-then-recover search fixture.');
  }
  const parsed = JSON.parse(testCase.expected_output);
  if (!parsed.fixtures) {
    throw new Error('Movie theater search fixture does not include runtime fixtures.');
  }
  return parsed.fixtures;
}

async function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 1_000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForServer(childProcess, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childProcess && childProcess.exitCode !== null) {
      throw new Error(`Vite exited early with code ${childProcess.exitCode}.`);
    }
    try {
      const response = await fetch(baseURL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // Server is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${baseURL}.`);
}

function startServer() {
  return spawn(
    process.execPath,
    ['../scripts/run-package-bin.mjs', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: packageRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

function stopProcess(childProcess) {
  if (!childProcess || childProcess.exitCode !== null || childProcess.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  childProcess.kill('SIGTERM');
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function parsePostJson(route) {
  const text = route.request().postData() ?? '{}';
  return JSON.parse(text);
}

async function installRoutes(page, fixtures) {
  await page.route('**/api/copilot/status', (route) => fulfillJson(route, {
    available: true,
    authenticated: true,
    authType: 'test',
    login: 'runtime-proof',
    models: [{
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      reasoning: false,
      vision: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    signInCommand: 'copilot login',
    signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
  }));

  await page.route('**/api/copilot/chat', (route) => fulfillJson(route, {
    error: 'Runtime search proof should execute through the tool pipeline, not raw Copilot chat.',
  }, 500));

  await page.route('**/api/web-search', (route) => {
    const request = parsePostJson(route);
    const query = String(request.query ?? '').trim().replace(/\s+/g, ' ');
    const result = fixtures.searchResults[query] ?? fixtures.searchResults['*'] ?? {
      status: 'empty',
      query,
      results: [],
      reason: `No runtime proof fixture matched "${query}".`,
    };
    return fulfillJson(route, result);
  });

  await page.route('**/api/web-page', (route) => {
    const request = parsePostJson(route);
    const url = String(request.url ?? '').trim();
    const result = fixtures.pageResults[url] ?? {
      status: 'unavailable',
      url,
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
      reason: `No runtime proof page fixture matched "${url}".`,
    };
    return fulfillJson(route, result);
  });
}

async function seedMemory(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('agent-browser:user-context-memory:v1', JSON.stringify({
      Research: [{
        id: 'location.city',
        label: 'Saved city',
        value: 'Arlington Heights, IL',
        source: 'workspace-memory',
        updatedAt: '2026-04-26T00:00:00.000Z',
      }],
    }));
  });
}

async function runBrowserProof() {
  const fixtures = fixtureContract();
  const shouldStartServer = !(await isPortOpen());
  const server = shouldStartServer ? startServer() : null;
  const serverOutput = [];
  server?.stdout.on('data', (chunk) => serverOutput.push(String(chunk)));
  server?.stderr.on('data', (chunk) => serverOutput.push(String(chunk)));

  let browser;
  const pageOutput = [];
  try {
    await waitForServer(server);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('console', (message) => pageOutput.push(`[console:${message.type()}] ${message.text()}`));
    page.on('pageerror', (error) => pageOutput.push(`[pageerror] ${error.message}`));
    await installRoutes(page, fixtures);
    await seedMemory(page);
    page.setDefaultTimeout(90_000);

    await page.goto(baseURL, { waitUntil: 'commit', timeout: 90_000 });
    await expect(page.getByRole('region', { name: 'Chat panel' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp', { timeout: 90_000 });
    await expect(page.getByRole('combobox', { name: 'GHCP model' })).toHaveValue('gpt-4.1', { timeout: 90_000 });

    await page.getByLabel('Chat input').fill("what're the best movie theaters near me?");
    await page.getByRole('button', { name: 'Send' }).click();

    const assistantBubbles = page.locator('.message.assistant .message-bubble-markdown');
    await expect(assistantBubbles).toHaveCount(1, { timeout: 5_000 });
    await expect(
      assistantBubbles.last().locator('a', { hasText: 'AMC Randhurst 12' }),
    ).toBeVisible({ timeout: 90_000 });
    const finalAnswer = (await assistantBubbles.last().innerText()).replace(/\s+/g, ' ').trim();
    const renderedLinkLabels = (await assistantBubbles.last().locator('a').allTextContents())
      .map((label) => label.replace(/\s+/g, ' ').trim().toLocaleLowerCase());

    for (const theater of EXPECTED_THEATERS) {
      expect(finalAnswer).toContain(theater);
    }
    for (const label of BAD_LABELS) {
      expect(renderedLinkLabels).not.toContain(label.toLocaleLowerCase());
    }
    await expect(page.getByText(/Working/i)).toHaveCount(0);
    await expect(page.locator('.stream-cursor')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`agent-browser runtime search proof passed: ${screenshotPath}`);
    console.log(finalAnswer);
  } catch (error) {
    const output = serverOutput.join('').trim();
    if (output) console.error(output);
    if (typeof pageOutput !== 'undefined' && pageOutput.length) console.error(pageOutput.join('\n'));
    throw error;
  } finally {
    await browser?.close();
    stopProcess(server);
  }
}

await runBrowserProof();
