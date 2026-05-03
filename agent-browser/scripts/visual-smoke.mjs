import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(scriptPath), '..');
const repoRoot = path.resolve(packageRoot, '..');
const outputPath = path.resolve(
  repoRoot,
  process.env.AGENT_BROWSER_VISUAL_SMOKE_SCREENSHOT
    ?? 'output/playwright/agent-browser-visual-smoke.png',
);

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not resolve a free localhost port.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForServer(url, childProcess, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Vite exited early with code ${childProcess.exitCode}.`);
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // Server is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function stopProcess(childProcess) {
  if (childProcess.exitCode !== null || childProcess.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  childProcess.kill('SIGTERM');
}

async function main() {
  const port = Number(process.env.AGENT_BROWSER_VISUAL_SMOKE_PORT) || await findFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const serverOutput = [];
  const server = spawn(
    process.execPath,
    ['../scripts/run-package-bin.mjs', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: packageRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.on('data', (chunk) => serverOutput.push(String(chunk)));
  server.stderr.on('data', (chunk) => serverOutput.push(String(chunk)));

  let browser;
  try {
    await waitForServer(baseURL, server);
    await mkdir(path.dirname(outputPath), { recursive: true });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.route('**/api/copilot/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          authenticated: false,
          models: [],
          signInCommand: 'copilot login',
          signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
        }),
      });
    });

    const navigationTimeoutMs = 120_000;
    const shellTimeoutMs = 30_000;

    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(page).toHaveTitle('Agent Browser');
    await expect(page.getByLabel('Omnibar')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Harness dashboard' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Benchmark routing' }).click();
    await expect(page.getByRole('checkbox', { name: /benchmark routing/i })).toBeVisible({ timeout: shellTimeoutMs });
    const benchmarkObjective = page.getByLabel('Benchmark routing objective');
    await expect(benchmarkObjective).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText(/Fallback priors|benchmark source|Refreshing evidence/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await benchmarkObjective.scrollIntoViewIfNeeded();
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`agent-browser visual smoke passed: ${outputPath}`);
  } catch (error) {
    const output = serverOutput.join('').trim();
    if (output) {
      console.error(output);
    }
    throw error;
  } finally {
    await browser?.close();
    stopProcess(server);
  }
}

await main();
