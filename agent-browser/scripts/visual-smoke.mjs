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
const marketplaceOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-extensions-marketplace.png');
const evaluationOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-evaluation-observability.png');
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

    await page.addInitScript(() => {
      const workspaceId = 'ws-research';
      const sessionId = 'visual-eval-session';
      localStorage.setItem('agent-browser.workspace-root', JSON.stringify({
        id: 'root',
        name: 'Root',
        type: 'root',
        expanded: true,
        children: [
          {
            id: workspaceId,
            name: 'Research',
            type: 'workspace',
            expanded: true,
            activeMemory: true,
            color: '#60a5fa',
            children: [
              {
                id: `${workspaceId}:category:browser`,
                name: 'Browser',
                type: 'folder',
                nodeKind: 'browser',
                expanded: true,
                children: [],
              },
              {
                id: `${workspaceId}:category:session`,
                name: 'Sessions',
                type: 'folder',
                nodeKind: 'session',
                expanded: true,
                children: [
                  {
                    id: sessionId,
                    name: 'Evaluation session',
                    type: 'tab',
                    nodeKind: 'session',
                    persisted: true,
                    filePath: `${workspaceId}:session:1`,
                  },
                ],
              },
              {
                id: `${workspaceId}:category:files`,
                name: 'Files',
                type: 'folder',
                nodeKind: 'files',
                expanded: false,
                children: [],
              },
              {
                id: `${workspaceId}:clipboard`,
                name: 'Clipboard',
                type: 'tab',
                nodeKind: 'clipboard',
              },
            ],
          },
        ],
      }));
      localStorage.setItem('agent-browser.workspace-view-state-by-workspace', JSON.stringify({
        [workspaceId]: {
          openTabIds: [],
          editingFilePath: null,
          dashboardOpen: true,
          activeMode: 'agent',
          activeSessionIds: [],
          mountedSessionFsIds: [sessionId],
          panelOrder: [],
          activeArtifactPanel: null,
        },
      }));
      localStorage.setItem('agent-browser.chat-messages-by-session', JSON.stringify({
        [sessionId]: [
          {
            id: `${sessionId}:system`,
            role: 'system',
            status: 'complete',
            content: 'Agent Browser ready.',
          },
          {
            id: 'visual-eval-assistant',
            role: 'assistant',
            status: 'complete',
            content: 'Captured visual evidence and completed the run.',
            cards: [{ app: 'Browser evidence', args: { screenshot: 'agent-browser-visual-smoke.png' } }],
            processEntries: [
              {
                id: 'visual-reasoning',
                position: 0,
                ts: 1000,
                endedAt: 1300,
                kind: 'reasoning',
                actor: 'planner',
                summary: 'Planned visual validation',
                transcript: 'Use the process graph and screenshot evidence.',
                status: 'done',
              },
              {
                id: 'visual-tool',
                position: 1,
                ts: 1400,
                endedAt: 1800,
                kind: 'tool-call',
                actor: 'playwright',
                summary: 'Capture browser screenshot',
                payload: { screenshot: 'agent-browser-visual-smoke.png' },
                status: 'done',
              },
            ],
          },
        ],
      }));
      sessionStorage.setItem('agent-browser.session.active-workspace-id', JSON.stringify(workspaceId));
      sessionStorage.setItem('agent-browser.session.active-panel', JSON.stringify('workspaces'));
    });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(page).toHaveTitle('Agent Browser');
    await expect(page.getByLabel('Omnibar')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Harness dashboard' })).toBeVisible({ timeout: shellTimeoutMs });
    const workspaceTree = page.getByRole('tree', { name: 'Workspace tree' });
    await expect(workspaceTree).toBeVisible({ timeout: shellTimeoutMs });
    await workspaceTree.getByRole('button', { name: 'Evaluation session', exact: true }).click();
    await page.getByRole('button', { name: /Process.*2 events/ }).click();
    const evaluationObservability = page.getByLabel('Evaluation-native observability');
    await expect(evaluationObservability).toBeVisible({ timeout: shellTimeoutMs });
    await expect(evaluationObservability.getByText('Evaluation', { exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(evaluationObservability.getByText('Live experiment')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(evaluationObservability.getByText('live:visual-eval-assistant')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: evaluationOutputPath, fullPage: true });
    await page.getByRole('button', { name: 'Back to chat' }).click();
    await page.getByRole('button', { name: 'Models', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Providers contents').getByText('Cursor', { exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByRole('button', { name: 'Built-in local inference' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText(/No localhost sidecar/)).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Benchmark routing' }).click();
    await expect(page.getByRole('checkbox', { name: /benchmark routing/i })).toBeVisible({ timeout: shellTimeoutMs });
    const benchmarkObjective = page.getByLabel('Benchmark routing objective');
    await expect(benchmarkObjective).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText(/Fallback priors|benchmark source|Refreshing evidence/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.getByRole('button', { name: 'Partner agent control plane' }).click();
    await expect(page.getByLabel('Enable partner-agent control plane')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Partner-agent audit level')).toHaveValue('standard', { timeout: shellTimeoutMs });
    await expect(page.getByText('Unified workflow')).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Adversary tool review' }).click();
    await expect(page.getByLabel('Enable adversary tool-call review')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Strictly block high-risk reviewed actions')).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Security review agents' }).click();
    await expect(page.getByLabel('Enable security review agents')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Enable inline PR security review')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Enable scheduled vulnerability scans')).toBeVisible({ timeout: shellTimeoutMs });
    await benchmarkObjective.scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Symphony' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Extensions', exact: true }).click();
    const installedExtensions = page.getByRole('region', { name: 'Installed extensions' });
    await expect(installedExtensions.getByRole('heading', { name: 'Installed extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(installedExtensions.getByText('0 installed').first()).toBeVisible({ timeout: shellTimeoutMs });
    const marketplace = page.getByRole('region', { name: 'Extension marketplace' });
    await expect(marketplace.getByRole('heading', { name: 'Marketplace' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByText('12 extensions')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByRole('heading', { name: 'IDE extensions' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByRole('heading', { name: 'Harness extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('heading', { name: 'Daemon extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('heading', { name: 'Provider extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('heading', { name: 'Runtime extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Symphony workflow orchestration').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('button', { name: 'Install Symphony workflow orchestration' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByRole('region', { name: 'Symphony task board' })).toHaveCount(0);
    await page.screenshot({ path: marketplaceOutputPath, fullPage: true });
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
    console.log(`agent-browser extensions marketplace smoke passed: ${marketplaceOutputPath}`);
    console.log(`agent-browser evaluation observability smoke passed: ${evaluationOutputPath}`);
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
