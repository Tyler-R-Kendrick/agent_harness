import { spawn } from 'node:child_process';
import { once } from 'node:events';
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
const PROCESS_SHUTDOWN_TIMEOUT_MS = 5_000;

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

async function stopProcess(childProcess) {
  if (childProcess.exitCode !== null || childProcess.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
  } else if (childProcess.pid) {
    try {
      process.kill(-childProcess.pid, 'SIGTERM');
    } catch {
      childProcess.kill('SIGTERM');
    }
  } else {
    childProcess.kill('SIGTERM');
  }
  const timeout = new Promise((resolve) => setTimeout(resolve, PROCESS_SHUTDOWN_TIMEOUT_MS, 'timeout'));
  const result = await Promise.race([once(childProcess, 'close'), timeout]);
  if (result !== 'timeout') return;
  if (process.platform !== 'win32' && childProcess.pid) {
    try {
      process.kill(-childProcess.pid, 'SIGKILL');
    } catch {
      childProcess.kill('SIGKILL');
    }
  } else {
    childProcess.kill('SIGKILL');
  }
  await Promise.race([once(childProcess, 'close'), timeout]);
}

async function main() {
  const port = Number(process.env.AGENT_BROWSER_VISUAL_SMOKE_PORT) || await findFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const serverOutput = [];
  const server = spawn(
    process.execPath,
    ['../scripts/run-package-bin.mjs', 'vite', '--force', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: packageRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      // Non-Windows cleanup sends signals to the process group via a negative PID.
      detached: process.platform !== 'win32',
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
    await page.route('**/api/cursor/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          authenticated: false,
          models: [],
          signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
          signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
        }),
      });
    });

    const navigationTimeoutMs = 300_000;
    const shellTimeoutMs = 30_000;

    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(page).toHaveTitle('Agent Browser');
    await expect(page.getByLabel('Omnibar')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Harness dashboard' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('tree', { name: 'Workspace tree' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Models' }).click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Cursor', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('button', { name: 'Built-in local inference' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText(/No localhost sidecar/)).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Benchmark routing' }).click();
    await expect(page.getByRole('checkbox', { name: /benchmark routing/i })).toBeVisible({ timeout: shellTimeoutMs });
    const benchmarkObjective = page.getByLabel('Benchmark routing objective');
    await expect(benchmarkObjective).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText(/Fallback priors|benchmark source|Refreshing evidence/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.getByRole('button', { name: 'Adversary tool review' }).click();
    await expect(page.getByLabel('Enable adversary tool-call review')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Strictly block high-risk reviewed actions')).toBeVisible({ timeout: shellTimeoutMs });
    await benchmarkObjective.scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Symphony' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Extensions' }).click();
    await expect(page.getByRole('button', { name: /Marketplace \(12\)/ })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('0 installed')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Symphony workflow orchestration').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('button', { name: 'Install Symphony workflow orchestration' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Symphony task board' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    const reviewPanel = page.getByRole('region', { name: 'PR review understanding' });
    await expect(reviewPanel).toBeVisible({ timeout: shellTimeoutMs });
    await expect(reviewPanel).toContainText('TK-47 review-native PR understanding', { timeout: shellTimeoutMs });
    await expect(reviewPanel).toContainText('Change groups', { timeout: shellTimeoutMs });
    await expect(reviewPanel).toContainText('Review risks', { timeout: shellTimeoutMs });
    await expect(reviewPanel).toContainText('Validation evidence', { timeout: shellTimeoutMs });
    await expect(reviewPanel).toContainText('Reviewer follow-up', { timeout: shellTimeoutMs });
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
    await stopProcess(server);
  }
}

await main();
