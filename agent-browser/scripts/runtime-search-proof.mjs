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
  'Cities Movie Times',
  'States Movie Times',
  'Zip Codes Movie Times',
  'Movie Times by Cities',
  'Movie Times by States',
  'Movie Times by Zip Codes',
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

const BAD_BAR_LABELS = [
  'Yelp: Best Bars in Arlington Heights, IL',
  "Chicago Bound: Arlington Heights' Best Bars",
  'Yellow Pages: Bars in Arlington Heights',
  'Restaurantji: Best Bars near Arlington Heights',
  'Restaurant Guru: Top 7 pubs & bars',
  'Best Bars',
  'Restaurants',
  'Reviews',
  'Support Enable',
  'Join Now Enable',
  'Enable dark mode',
  'Shop Categories',
  'About Us',
  'Chicago Bound',
  "Arlington Heights' Best Bars Spots [2026 Guide]",
];

const EXPECTED_THEATERS = [
  'AMC Randhurst 12',
  'CMX Arlington Heights',
  'Classic Cinemas Elk Grove Theatre',
];

const EXPECTED_BARS = [
  "Peggy Kinnane's Irish Restaurant & Pub",
  'Hey Nonny',
  "Cortland's Garage",
];

function fixtureContract() {
  const cases = buildSearchEvalCases();
  const theaterCase = cases.find((candidate) => candidate.id === 'negative-theaters-browser-coordinate-directory-labels');
  const barsSubjectSwitchCase = cases.find((candidate) => candidate.id === 'negative-follow-up-bars-article-page-chrome');
  const barsCase = cases.find((candidate) => candidate.id === 'negative-bars-aggregate-source-pages');
  const barsFollowUpCase = cases.find((candidate) => candidate.id === 'follow-up-bars-show-me-3-more');
  if (!theaterCase?.expected_output || !barsSubjectSwitchCase?.expected_output || !barsCase?.expected_output || !barsFollowUpCase?.expected_output) {
    throw new Error('Missing movie theater bad-then-recover search fixture.');
  }
  const theaterParsed = JSON.parse(theaterCase.expected_output);
  const barsSubjectSwitchParsed = JSON.parse(barsSubjectSwitchCase.expected_output);
  const barsParsed = JSON.parse(barsCase.expected_output);
  const barsFollowUpParsed = JSON.parse(barsFollowUpCase.expected_output);
  if (!theaterParsed.fixtures || !barsSubjectSwitchParsed.fixtures || !barsParsed.fixtures || !barsFollowUpParsed.fixtures) {
    throw new Error('Runtime search fixtures do not include required theater and bar data.');
  }
  return {
    memoryResult: theaterParsed.fixtures.memoryResult,
    searchResults: {
      ...theaterParsed.fixtures.searchResults,
      ...barsSubjectSwitchParsed.fixtures.searchResults,
      ...barsParsed.fixtures.searchResults,
      ...barsFollowUpParsed.fixtures.searchResults,
    },
    pageResults: {
      ...theaterParsed.fixtures.pageResults,
      ...barsSubjectSwitchParsed.fixtures.pageResults,
      ...barsParsed.fixtures.pageResults,
      ...barsFollowUpParsed.fixtures.pageResults,
    },
  };
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

async function installRoutes(page, fixtures, searchQueries) {
  const queryCounts = new Map();
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
    const count = (queryCounts.get(query) ?? 0) + 1;
    queryCounts.set(query, count);
    searchQueries.push(query);
    const firstClosestBarsResult = query === 'closest bars Arlington Heights IL' && count === 1
      ? {
        status: 'found',
        query,
        results: [{
          title: 'Sports Page Bar & Grill Arlington Heights',
          url: 'https://www.sportspagebarandgrill.com/',
          snippet: 'Sports Page Bar & Grill Arlington Heights is a bar in Arlington Heights, IL.',
        }],
      }
      : undefined;
    const result = firstClosestBarsResult ?? fixtures.searchResults[query] ?? fixtures.searchResults['*'] ?? {
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
  let context;
  let page;
  const pageOutput = [];
  const searchQueries = [];
  try {
    await waitForServer(server);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      geolocation: { latitude: 42.11713258868569, longitude: -87.9912774939386 },
      permissions: ['geolocation'],
    });
    page = await context.newPage();
    page.on('console', (message) => pageOutput.push(`[console:${message.type()}] ${message.text()}`));
    page.on('pageerror', (error) => pageOutput.push(`[pageerror] ${error.message}`));
    await installRoutes(page, fixtures, searchQueries);
    await seedMemory(page);
    page.setDefaultTimeout(90_000);

    await page.goto(baseURL, { waitUntil: 'commit', timeout: 90_000 });
    await expect(page.getByRole('region', { name: 'Chat panel' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp', { timeout: 90_000 });
    await expect(page.getByRole('combobox', { name: 'GHCP model' })).toHaveValue('gpt-4.1', { timeout: 90_000 });

    await page.getByLabel('Chat input').fill('show me theaters near me');
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
    expect(searchQueries[0]).toBe('city state for coordinates 42.12 -87.99');
    expect(searchQueries).toContain('nearby theaters Arlington Heights IL');
    expect(searchQueries).toContain('theaters names near Arlington Heights IL');
    expect(searchQueries.join('\n')).not.toMatch(/42\.11713258868569|-87\.9912774939386/);
    await expect(page.getByText(/Working/i)).toHaveCount(0);
    await expect(page.locator('.stream-cursor')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();

    await page.getByLabel('Chat input').fill('what about bars?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(assistantBubbles).toHaveCount(2, { timeout: 90_000 });
    await expect(
      assistantBubbles.last().locator('a', { hasText: "Peggy Kinnane's Irish Restaurant & Pub" }),
    ).toBeVisible({ timeout: 90_000 });
    const subjectSwitchBarsAnswer = (await assistantBubbles.last().innerText()).replace(/\s+/g, ' ').trim();
    const barLinkLabels = (await assistantBubbles.last().locator('a').allTextContents())
      .map((label) => label.replace(/\s+/g, ' ').trim().toLocaleLowerCase());
    for (const bar of EXPECTED_BARS) {
      expect(subjectSwitchBarsAnswer).toContain(bar);
    }
    for (const label of BAD_BAR_LABELS) {
      expect(barLinkLabels).not.toContain(label.toLocaleLowerCase());
    }
    expect(searchQueries).toContain('bars Arlington Heights IL');
    await expect(page.getByText(/User input needed/i)).toHaveCount(0);
    await expect(page.getByText(/Working/i)).toHaveCount(0);
    await expect(page.locator('.stream-cursor')).toHaveCount(0);

    await page.getByLabel('Chat input').fill('what about closest bars?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(assistantBubbles).toHaveCount(3, { timeout: 90_000 });
    await expect(
      assistantBubbles.last().locator('a', { hasText: 'Sports Page Bar & Grill Arlington Heights' }),
    ).toBeVisible({ timeout: 90_000 });
    const barsAnswer = (await assistantBubbles.last().innerText()).replace(/\s+/g, ' ').trim();
    const closestBarLinkLabels = (await assistantBubbles.last().locator('a').allTextContents())
      .map((label) => label.replace(/\s+/g, ' ').trim().toLocaleLowerCase());
    expect(barsAnswer).toContain('Sports Page Bar & Grill Arlington Heights');
    for (const label of BAD_BAR_LABELS) {
      expect(closestBarLinkLabels).not.toContain(label.toLocaleLowerCase());
    }
    await expect(page.getByText(/User input needed/i)).toHaveCount(0);
    await expect(page.getByText(/Working/i)).toHaveCount(0);
    await expect(page.locator('.stream-cursor')).toHaveCount(0);

    await page.getByLabel('Chat input').fill('show me 3 more');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(assistantBubbles).toHaveCount(4, { timeout: 90_000 });
    await expect(
      assistantBubbles.last().locator('a', { hasText: "Peggy Kinnane's Irish Restaurant & Pub" }),
    ).toBeVisible({ timeout: 90_000 });
    const followUpAnswer = (await assistantBubbles.last().innerText()).replace(/\s+/g, ' ').trim();
    const followUpLabels = (await assistantBubbles.last().locator('a').allTextContents())
      .map((label) => label.replace(/\s+/g, ' ').trim().toLocaleLowerCase());
    for (const bar of EXPECTED_BARS) {
      expect(followUpAnswer).toContain(bar);
    }
    expect(followUpLabels).not.toContain('sports page bar & grill arlington heights');
    for (const label of BAD_BAR_LABELS) {
      expect(followUpLabels).not.toContain(label.toLocaleLowerCase());
    }
    expect(searchQueries).toContain('closest bars Arlington Heights IL');
    expect(searchQueries).not.toContain('show me 3 more');
    await expect(page.getByText(/User input needed/i)).toHaveCount(0);
    await expect(page.getByText(/Working/i)).toHaveCount(0);
    await expect(page.locator('.stream-cursor')).toHaveCount(0);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`agent-browser runtime search proof passed: ${screenshotPath}`);
    console.log(`runtime search queries: ${JSON.stringify(searchQueries)}`);
    console.log(finalAnswer);
    console.log(subjectSwitchBarsAnswer);
    console.log(barsAnswer);
    console.log(followUpAnswer);
  } catch (error) {
    try {
      await page?.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`agent-browser runtime search proof failed; screenshot: ${screenshotPath}`);
      console.error(`runtime search queries before failure: ${JSON.stringify(searchQueries)}`);
    } catch {
      // Best-effort failure artifact only.
    }
    const output = serverOutput.join('').trim();
    if (output) console.error(output);
    if (typeof pageOutput !== 'undefined' && pageOutput.length) console.error(pageOutput.join('\n'));
    throw error;
  } finally {
    await context?.close();
    await browser?.close();
    stopProcess(server);
  }
}

await runBrowserProof();
