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
const extensionDetailOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-extension-detail.png');
const extensionFeatureOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-extension-feature.png');
const artifactWorktreeOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-artifact-worktree.png');
const workflowCanvasOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-workflow-canvas.png');
const openDesignTokenReviewOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-open-design-token-review.png');
const openDesignTokenReviewViewportOutputPaths = [
  {
    name: 'mobile',
    viewport: { width: 390, height: 840 },
    outputPath: path.resolve(repoRoot, 'output/playwright/agent-browser-open-design-token-review-mobile.png'),
  },
  {
    name: 'tablet',
    viewport: { width: 768, height: 900 },
    outputPath: path.resolve(repoRoot, 'output/playwright/agent-browser-open-design-token-review-tablet.png'),
  },
];
const evaluationOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-evaluation-observability.png');
const repoWikiOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-repository-wiki.png');
const repoWikiPagesOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-repository-wiki-pages.png');
const repoWikiGraphOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-repository-wiki-graph.png');
const repoWikiMemoryOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-repository-wiki-memory.png');
const repoWikiMobileOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-repository-wiki-mobile.png');
const dashboardCanvasOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-dashboard-canvas.png');
const widgetEditorOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-widget-editor.png');
const historyTimelineOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-history-unified-timeline.png');
const typedSdkOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-typed-run-sdk.png');
const mediaAgentOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-07-media-agent-visual-smoke.png');
const specDrivenDevelopmentOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-08-spec-driven-development-visual-smoke.png');
const persistentMemoryGraphOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-08-persistent-memory-graphs-visual-smoke.png');
const graphKnowledgeOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-08-graph-knowledge-visual-smoke.png');
const gitStubOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-09-git-stub-terminal-visual-smoke.png');
const dashboardCanvasViewportOutputPaths = [
  {
    name: 'mobile',
    viewport: { width: 375, height: 820 },
    outputPath: path.resolve(repoRoot, 'output/playwright/agent-browser-dashboard-canvas-mobile.png'),
  },
  {
    name: 'tablet',
    viewport: { width: 768, height: 900 },
    outputPath: path.resolve(repoRoot, 'output/playwright/agent-browser-dashboard-canvas-tablet.png'),
  },
  {
    name: 'desktop',
    viewport: { width: 1280, height: 820 },
    outputPath: dashboardCanvasOutputPath,
  },
  {
    name: 'wide',
    viewport: { width: 1920, height: 1080 },
    outputPath: path.resolve(repoRoot, 'output/playwright/agent-browser-dashboard-canvas-wide.png'),
  },
];
const symphonyOutputPath = path.resolve(repoRoot, 'output/playwright/agent-browser-symphony-system.png');
const sharedAgentsOutputPath = path.resolve(repoRoot, 'docs/superpowers/plans/2026-05-07-shared-workspace-agents-governance-visual-smoke.png');
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

async function waitForServer(url, childProcess, timeoutMs = 180_000) {
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

async function assertDashboardCanvasVisible(page, timeoutMs) {
  const dashboard = page.getByRole('region', { name: 'Harness dashboard' });
  await expect(dashboard).toBeVisible({ timeout: timeoutMs });
  const canvas = page.getByLabel('Infinite session canvas');
  await expect(canvas).toBeVisible({ timeout: timeoutMs });
  await expect(dashboard.getByRole('article', { name: 'Session summary widget' })).toBeVisible({ timeout: timeoutMs });
  await expect(dashboard.getByRole('article', { name: 'Knowledge widget' })).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByRole('region', { name: 'Git worktree status' })).toHaveCount(0, { timeout: timeoutMs });
  await expect(page.getByRole('button', { name: 'Customize' })).toHaveCount(0, { timeout: timeoutMs });
  await expect(page.getByRole('button', { name: 'New session widget' })).toHaveCount(0, { timeout: timeoutMs });
  const canvasBox = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(canvasBox).not.toBeNull();
  if (canvasBox && viewport) {
    expect(Math.floor(canvasBox.x)).toBeGreaterThanOrEqual(0);
    const rightEdge = Math.ceil(canvasBox.x + canvasBox.width);
    if (rightEdge > viewport.width) {
      const layoutDiagnostics = await canvas.evaluate((element) => {
        const selectors = [
          '.harness-dashboard-canvas',
          '.harness-dashboard-panel',
          '.browser-split-view',
          '.content-area',
          '.app-shell',
        ];
        return selectors.map((selector) => {
          const candidate = element.closest(selector);
          if (!candidate) return { selector, missing: true };
          const rect = candidate.getBoundingClientRect();
          const style = getComputedStyle(candidate);
          return {
            selector,
            x: Math.round(rect.x),
            width: Math.round(rect.width),
            minWidth: style.minWidth,
            display: style.display,
            overflow: style.overflow,
          };
        });
      });
      throw new Error(
        `Dashboard canvas overflows ${viewport.width}px viewport at ${rightEdge}px: ${JSON.stringify(layoutDiagnostics)}`,
      );
    }
  }
}

async function captureDashboardCanvasViewportMatrix(page, timeoutMs) {
  for (const { name, viewport, outputPath: viewportOutputPath } of dashboardCanvasViewportOutputPaths) {
    await page.setViewportSize(viewport);
    await assertDashboardCanvasVisible(page, timeoutMs);
    await page.screenshot({ path: viewportOutputPath, fullPage: true });
    console.log(`agent-browser dashboard canvas ${name} smoke passed: ${viewportOutputPath}`);
  }
}

async function captureOpenDesignTokenReviewViewportMatrix(page, tokenReview, timeoutMs) {
  for (const { name, viewport, outputPath: viewportOutputPath } of openDesignTokenReviewViewportOutputPaths) {
    await page.setViewportSize(viewport);
    await expect(tokenReview).toBeVisible({ timeout: timeoutMs });
    await tokenReview.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(tokenReview.getByLabel('Design Studio approval composition sample')).toContainText(
      'Agent Browser approval composition',
      { timeout: timeoutMs },
    );
    await expect(tokenReview.getByLabel('Display type visual sample')).toContainText('Aa', {
      timeout: timeoutMs,
    });
    await page.screenshot({ path: viewportOutputPath, fullPage: true });
    console.log(`agent-browser Design Studio token review ${name} smoke passed: ${viewportOutputPath}`);
  }
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
      // Non-Windows cleanup sends signals to the process group via a negative PID.
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.on('data', (chunk) => serverOutput.push(String(chunk)));
  server.stderr.on('data', (chunk) => serverOutput.push(String(chunk)));

  let browser;
  try {
    await waitForServer(baseURL, server, 300_000);
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
    await page.route('**/api/git-worktree/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          cwd: repoRoot,
          worktreeRoot: repoRoot,
          branch: 'feature/worktree-ui',
          head: 'abc1234',
          upstream: 'origin/main',
          ahead: 1,
          behind: 0,
          isClean: false,
          files: [
            {
              path: 'agent-browser/src/App.tsx',
              status: 'modified',
              staged: false,
              unstaged: true,
              conflicted: false,
            },
            {
              path: 'agent-browser/src/features/worktree/GitWorktreePanel.tsx',
              status: 'added',
              staged: true,
              unstaged: false,
              conflicted: false,
            },
          ],
          summary: {
            changed: 2,
            staged: 1,
            unstaged: 1,
            untracked: 0,
            conflicts: 0,
          },
        }),
      });
    });
    await page.route('**/api/git-worktree/diff?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          path: 'agent-browser/src/App.tsx',
          patch: [
            'diff --git a/agent-browser/src/App.tsx b/agent-browser/src/App.tsx',
            'index 1111111..2222222 100644',
            '--- a/agent-browser/src/App.tsx',
            '+++ b/agent-browser/src/App.tsx',
            '@@ -1 +1 @@',
            '-old dashboard',
            '+new worktree dashboard',
            '',
          ].join('\n'),
          source: 'unstaged',
          isBinary: false,
        }),
      });
    });

    const navigationTimeoutMs = 900_000;
    const shellTimeoutMs = 30_000;

    await page.addInitScript(() => {
      const workspaceId = 'ws-research';
      const sessionId = 'visual-eval-session';
      const subthreadSessionId = 'visual-eval-session-branch-agent-proof';
      const largeVisualToolOutput = Array.from(
        { length: 260 },
        (_, index) => `SCREENSHOT_TRACE_${index}: visual smoke captured layout metrics, accessibility landmarks, and context-manager tool cache proof.`,
      ).join('\n');
      const notesFileOpId = 'file-op:ws-research:notes-md:codex:1:20260508T012100000Z';
      const notesFileSnapshotId = 'file-snapshot:ws-research:notes-md:root:20260508T012000000Z';
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
                  {
                    id: subthreadSessionId,
                    name: 'Branch: Agent proof',
                    type: 'tab',
                    nodeKind: 'session',
                    persisted: true,
                    filePath: `${workspaceId}:session:agent-proof`,
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
            id: 'visual-eval-user',
            role: 'user',
            status: 'complete',
            content: 'Visual validation and checkpoint review',
          },
              {
                id: 'visual-eval-assistant',
                role: 'assistant',
                status: 'complete',
                content: 'Captured visual evidence and completed the run.',
                cards: [{ app: 'Browser evidence', args: { screenshot: 'output/playwright/agent-browser-visual-smoke.png' } }],
                processEntries: [
                  {
                    id: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
                    position: 0,
                    ts: 900,
                    kind: 'handoff',
                    actor: 'checkpoint',
                    summary: 'Approval before deployment',
                    transcript: 'Suspended at before deploy tool call\nRequired input: operator approval',
                    payload: {
                      checkpoint: {
                        id: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
                        sessionId,
                        workspaceId,
                        reason: 'approval',
                        status: 'suspended',
                        summary: 'Approval before deployment',
                        boundary: 'before deploy tool call',
                        requiredInput: 'operator approval',
                        resumeToken: 'resume:visual-eval-session:2026-05-07T02:30:00.000Z',
                        artifacts: ['output/playwright/agent-browser-visual-smoke.png'],
                        createdAt: '2026-05-07T02:30:00.000Z',
                        updatedAt: '2026-05-07T02:30:00.000Z',
                        expiresAt: '2026-05-07T06:30:00.000Z',
                      },
                    },
                    branchId: 'checkpoint:visual-eval-session',
                    status: 'active',
                    timeoutMs: 14_400_000,
                  },
                  {
                    id: 'visual-reasoning',
                    position: 1,
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
                    position: 2,
                    ts: 1400,
                    endedAt: 1800,
                kind: 'tool-call',
                actor: 'playwright',
                summary: 'Capture browser screenshot',
                transcript: largeVisualToolOutput,
                payload: {
                  screenshot: 'output/playwright/agent-browser-visual-smoke.png',
                  stdout: largeVisualToolOutput,
                },
                status: 'done',
              },
            ],
          },
          {
            id: 'visual-elicitation-assistant',
            role: 'assistant',
            status: 'complete',
            content: 'Choose how the agent should continue.',
            cards: [
              {
                app: 'Elicitation',
                kind: 'elicitation',
                requestId: 'elicitation-visual',
                prompt: 'Choose how the agent should continue.',
                status: 'pending',
                args: {},
                fields: [
                  {
                    id: 'notes',
                    label: 'Notes',
                    type: 'textarea',
                    defaultValue: 'Prefer official docs',
                  },
                  {
                    id: 'urgency',
                    label: 'Urgency',
                    type: 'select',
                    defaultValue: 'soon',
                    options: [
                      { label: 'Soon', value: 'soon' },
                      { label: 'Later', value: 'later' },
                    ],
                  },
                  {
                    id: 'notify',
                    label: 'Notify me',
                    type: 'checkbox',
                    defaultValue: 'true',
                  },
                  {
                    id: 'count',
                    label: 'Result count',
                    type: 'number',
                    defaultValue: '3',
                  },
                ],
              },
            ],
          },
        ],
        [subthreadSessionId]: [
          {
            id: `${subthreadSessionId}:system`,
            role: 'system',
            status: 'complete',
            content: 'Agent Browser branch session ready.',
          },
          {
            id: 'visual-branch-user',
            role: 'user',
            status: 'complete',
            content: 'Keep the proof focused on visible browser evidence.',
          },
          {
            id: 'visual-branch-assistant',
            role: 'assistant',
            status: 'complete',
            content: 'Branch proof captured for the main conversation.',
          },
        ],
      }));
      localStorage.setItem('agent-browser.workspace-file-crdt-histories-by-workspace', JSON.stringify({
        [workspaceId]: {
          'notes.md': {
            version: 1,
            workspaceId,
            path: 'notes.md',
            snapshots: [
              {
                id: notesFileSnapshotId,
                workspaceId,
                path: 'notes.md',
                opId: null,
                content: 'draft',
                createdAt: '2026-05-08T01:20:00.000Z',
              },
            ],
            operations: [
              {
                id: notesFileOpId,
                workspaceId,
                path: 'notes.md',
                actorId: 'codex',
                sequence: 1,
                createdAt: '2026-05-08T01:21:00.000Z',
                parentOpId: null,
                index: 5,
                deleteCount: 0,
                deleteText: '',
                insertText: '\nready',
              },
            ],
            headOpId: notesFileOpId,
            actorSequences: { user: 0, codex: 1 },
            updatedAt: '2026-05-08T01:21:00.000Z',
          },
        },
      }));
      localStorage.setItem('agent-browser.run-checkpoint-state', JSON.stringify({
        checkpoints: [
          {
            id: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
            sessionId,
            workspaceId,
            reason: 'approval',
            status: 'suspended',
            summary: 'Approval before deployment',
            boundary: 'before deploy tool call',
            requiredInput: 'operator approval',
            resumeToken: 'resume:visual-eval-session:2026-05-07T02:30:00.000Z',
            artifacts: ['agent-browser-visual-smoke.png'],
            createdAt: '2026-05-07T02:30:00.000Z',
            updatedAt: '2026-05-07T02:30:00.000Z',
            expiresAt: '2026-05-07T06:30:00.000Z',
          },
        ],
        audit: [
          {
            id: 'audit:checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z:suspended',
            checkpointId: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
            action: 'suspended',
            actor: 'agent-browser',
            summary: 'Suspended at before deploy tool call',
            createdAt: '2026-05-07T02:30:00.000Z',
          },
        ],
        policy: {
          defaultTimeoutMinutes: 240,
          requireOperatorConfirmation: true,
          preserveArtifacts: true,
        },
      }));
      localStorage.setItem('agent-browser.session-chapter-state', JSON.stringify({
        enabled: true,
        policy: {
          automaticCompression: true,
          compressAfterMessageCount: 2,
          targetTokenBudget: 1200,
          retainRecentMessageCount: 4,
          preserveEvidenceRefs: true,
          renderCompressedMessages: true,
          contextMode: 'standard',
          toolOutputCache: {
            enabled: true,
            inlineTokenLimit: 800,
            fileTokenThreshold: 2400,
            maxMemoryEntries: 50,
            cacheRoot: '.agent-browser/context-cache',
          },
        },
        sessions: {
          [sessionId]: {
            sessionId,
            workspaceId,
            workspaceName: 'Research',
            updatedAt: '2026-05-08T04:00:00.000Z',
            chapters: [
              {
                id: `chapter:${sessionId}:1`,
                sessionId,
                workspaceId,
                workspaceName: 'Research',
                title: 'Chapter 1: Visual validation and checkpoint review',
                status: 'compressed',
                startedAt: '2026-05-08T04:00:00.000Z',
                updatedAt: '2026-05-08T04:00:00.000Z',
                messageIds: ['visual-eval-user', 'visual-eval-assistant'],
                sourceTraceRefs: ['message:visual-eval-user', 'message:visual-eval-assistant', 'process:visual-tool'],
                evidenceRefs: ['evidence:output/playwright/agent-browser-visual-smoke.png'],
                validationRefs: ['validation:visual-tool:Capture browser screenshot'],
                toolOutputRefs: ['tool-output:visual-tool'],
                compressedContext: {
                  summary: 'Captured visual smoke evidence and preserved the checkpoint trace for review.',
                  carryForward: [
                    'Visual validation produced output/playwright/agent-browser-visual-smoke.png.',
                    'Resume checkpoints and browser evidence remain linked to the original process trace.',
                    'Tool output cache refs preserved: tool-output:visual-tool.',
                  ],
                  sourceTraceRefs: ['message:visual-eval-user', 'message:visual-eval-assistant', 'process:visual-tool'],
                  evidenceRefs: ['evidence:output/playwright/agent-browser-visual-smoke.png'],
                  validationRefs: ['validation:visual-tool:Capture browser screenshot'],
                  toolOutputRefs: ['tool-output:visual-tool'],
                  retainedRecentMessageIds: ['visual-eval-user', 'visual-eval-assistant'],
                  tokenBudget: 1200,
                  estimatedTokens: 42,
                  contextMode: 'standard',
                  createdAt: '2026-05-08T04:00:00.000Z',
                },
              },
            ],
          },
        },
        toolOutputCache: {
          'tool-output:visual-tool': {
            id: 'tool-output:visual-tool',
            sessionId,
            sourceTraceRef: 'process:visual-tool',
            storage: 'memory',
            tokenCount: 120,
            summary: 'Visual smoke output preserved behind a cache ref.',
            content: 'Visual smoke output preserved behind a cache ref.',
            createdAt: '2026-05-08T04:00:00.000Z',
          },
        },
        audit: [
          {
            id: 'audit:visual-eval-session:projected',
            sessionId,
            action: 'projected',
            summary: 'Projected 1 chapter for visual-eval-session.',
            createdAt: '2026-05-08T04:00:00.000Z',
          },
        ],
      }));
      localStorage.setItem('agent-browser.conversation-branching-state', JSON.stringify({
        enabled: true,
        workspaceId,
        workspaceName: 'Research',
        mainSessionId: sessionId,
        mainBranchId: 'main',
        mainHeadCommitId: 'merge-subthread-ws-research-agent-proof:ws-research:20260508T011000000Z',
        createdAt: '2026-05-08T01:00:00.000Z',
        updatedAt: '2026-05-08T01:10:00.000Z',
        settings: {
          enabled: true,
          includeBranchContext: true,
          showProcessGraphNodes: true,
          autoSummarizeOnMerge: true,
        },
        subthreads: [
          {
            id: 'subthread:ws-research:agent-proof',
            title: 'Agent proof branch',
            branchName: 'conversation/research/agent-proof',
            sessionId: subthreadSessionId,
            status: 'merged',
            createdAt: '2026-05-08T01:00:00.000Z',
            updatedAt: '2026-05-08T01:10:00.000Z',
            headCommitId: 'subthread-ws-research-agent-proof:ws-research:20260508T010500000Z',
            lastMergedCommitId: 'subthread-ws-research-agent-proof:ws-research:20260508T010500000Z',
            summary: 'Captured branch proof and returned the latest summary to main.',
          },
        ],
        commits: {
          'main:ws-research:20260508T010000000Z': {
            id: 'main:ws-research:20260508T010000000Z',
            branchId: 'main',
            parentIds: [],
            sourceSessionId: sessionId,
            messageIds: [],
            summary: 'Main thread before branch: Agent proof branch',
            createdAt: '2026-05-08T01:00:00.000Z',
          },
          'subthread-ws-research-agent-proof:ws-research:20260508T010500000Z': {
            id: 'subthread-ws-research-agent-proof:ws-research:20260508T010500000Z',
            branchId: 'subthread:ws-research:agent-proof',
            parentIds: ['main:ws-research:20260508T010000000Z'],
            sourceSessionId: sessionId,
            messageIds: ['visual-eval-assistant'],
            summary: 'Captured branch proof and returned the latest summary to main.',
            createdAt: '2026-05-08T01:05:00.000Z',
            mergedIntoMainAt: '2026-05-08T01:10:00.000Z',
          },
          'merge-subthread-ws-research-agent-proof:ws-research:20260508T011000000Z': {
            id: 'merge-subthread-ws-research-agent-proof:ws-research:20260508T011000000Z',
            branchId: 'main',
            parentIds: [
              'main:ws-research:20260508T010000000Z',
              'subthread-ws-research-agent-proof:ws-research:20260508T010500000Z',
            ],
            sourceSessionId: sessionId,
            messageIds: [],
            summary: 'Merged conversation/research/agent-proof: Captured branch proof and returned the latest summary to main.',
            createdAt: '2026-05-08T01:10:00.000Z',
          },
        },
      }));
      const actionBaseSnapshot = {
        workspaceId,
        workspaceName: 'Research',
        activePanel: 'workspaces',
        activeSessionIds: [sessionId],
        openTabIds: [],
        mountedSessionFsIds: [sessionId, subthreadSessionId],
        sessionIds: [sessionId, subthreadSessionId],
        sessionNamesById: {
          [sessionId]: 'Evaluation session',
          [subthreadSessionId]: 'Branch: Agent proof',
        },
        conversationBranchIds: ['subthread:ws-research:agent-proof:merged:subthread-ws-research-agent-proof:ws-research:20260508T010500000Z'],
        checkpointIds: ['checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z:suspended'],
        browserAgentRunIds: ['visual-eval-run:running:3'],
        scheduledAutomationIds: ['daily-workspace-audit:daily:2026-05-06T09:00:00.000Z'],
        chapterIds: ['chapter:visual-eval-session:1'],
        workspaceFileVersionIds: [`notes.md:${notesFileOpId}:2026-05-08T01:21:00.000Z`],
      };
      const actionModelsSnapshot = {
        ...actionBaseSnapshot,
        activePanel: 'models',
      };
      const actionHistorySnapshot = {
        ...actionModelsSnapshot,
        activePanel: 'history',
      };
      localStorage.setItem('agent-browser.workspace-action-history-state', JSON.stringify({
        version: 1,
        cursorByWorkspace: {
          [workspaceId]: 'action:ws-research:20260508T012002000Z:2',
        },
        actions: [
          {
            id: 'action:ws-research:20260508T012000000Z:1',
            workspaceId,
            workspaceName: 'Research',
            label: 'Opened Models',
            changedSlices: ['activePanel'],
            beforeSnapshot: actionBaseSnapshot,
            afterSnapshot: actionModelsSnapshot,
            createdAt: '2026-05-08T01:20:00.000Z',
          },
          {
            id: 'action:ws-research:20260508T012002000Z:2',
            workspaceId,
            workspaceName: 'Research',
            label: 'Opened History',
            changedSlices: ['activePanel'],
            beforeSnapshot: actionModelsSnapshot,
            afterSnapshot: actionHistorySnapshot,
            createdAt: '2026-05-08T01:20:02.000Z',
          },
        ],
      }));
      localStorage.setItem('agent-browser.artifacts-by-workspace', JSON.stringify({
        [workspaceId]: [
          {
            id: 'artifact-ws-research-dashboard',
            title: 'Launch dashboard',
            description: 'Persistent dashboard for launch evidence and next actions.',
            kind: 'workspace-surface:dashboard',
            sourceSessionId: sessionId,
            createdAt: '2026-05-07T03:00:00.000Z',
            updatedAt: '2026-05-07T03:20:00.000Z',
            files: [
              {
                path: 'dashboard.md',
                mediaType: 'text/markdown',
                content: '# Launch dashboard\n\n- Status: ready\n- Evidence: visual smoke',
              },
            ],
            references: [],
            versions: [
              {
                id: 'artifact-ws-research-dashboard-version-1',
                createdAt: '2026-05-07T03:20:00.000Z',
                title: 'Launch dashboard',
                description: 'Persistent dashboard for launch evidence and next actions.',
                kind: 'workspace-surface:dashboard',
                files: [
                  {
                    path: 'dashboard.md',
                    mediaType: 'text/markdown',
                    content: '# Launch dashboard\n\n- Status: drafting',
                  },
                ],
                references: [],
              },
            ],
          },
          {
            id: 'artifact-ws-research-checklist',
            title: 'Launch checklist',
            description: 'Follow-up checklist for launch execution.',
            kind: 'workspace-surface:checklist',
            sourceSessionId: sessionId,
            createdAt: '2026-05-07T03:05:00.000Z',
            updatedAt: '2026-05-07T03:05:00.000Z',
            files: [
              {
                path: 'checklist.md',
                mediaType: 'text/markdown',
                content: '# Launch checklist\n\n- [ ] Verify release',
              },
            ],
            references: [],
            versions: [],
          },
        ],
      }));
      localStorage.setItem('agent-browser.workspace-surfaces-by-workspace', JSON.stringify({
        [workspaceId]: [
          {
            id: 'surface-ws-research-artifact-ws-research-dashboard-dashboard-md',
            workspaceId,
            artifactId: 'artifact-ws-research-dashboard',
            artifactFilePath: 'dashboard.md',
            surfaceType: 'dashboard',
            renderTarget: 'dashboard',
            title: 'Launch dashboard surface',
            description: 'Agent-authored dashboard for release evidence.',
            createdByAgent: 'Researcher',
            ownerSessionId: sessionId,
            permissions: {
              canRead: true,
              canEdit: true,
              canRollback: true,
              canShare: false,
            },
            revision: 2,
            status: 'active',
            createdAt: '2026-05-07T03:00:00.000Z',
            updatedAt: '2026-05-07T03:20:00.000Z',
            versions: [
              {
                id: 'surface-ws-research-artifact-ws-research-dashboard-dashboard-md-revision-1',
                revision: 1,
                title: 'Launch dashboard surface',
                description: 'Agent-authored dashboard for release evidence.',
                surfaceType: 'dashboard',
                renderTarget: 'dashboard',
                artifactId: 'artifact-ws-research-dashboard',
                artifactFilePath: 'dashboard.md',
                permissions: {
                  canRead: true,
                  canEdit: true,
                  canRollback: true,
                  canShare: false,
                },
                status: 'active',
                createdAt: '2026-05-07T03:00:00.000Z',
              },
            ],
          },
        ],
      }));
      localStorage.setItem('agent-browser.shared-agent-registry-state', JSON.stringify({
        enabled: true,
        requirePublishApproval: true,
        showAuditTrail: true,
        trackUsageAnalytics: true,
        agents: [
          {
            id: 'shared-agent-team-reviewer',
            name: 'Team reviewer',
            description: 'Reusable browser review agent for PR diffs, visual evidence, and release notes.',
            version: '1.2.0',
            status: 'published',
            owner: 'Platform',
            visibility: 'team',
            allowedRoles: ['viewer', 'editor', 'publisher'],
            sourceProvider: 'specialist',
            capabilities: ['PR review', 'browser evidence', 'release summary'],
            toolScopes: ['git-worktree:read', 'browser:evidence', 'linear:comment'],
            updatedAt: '2026-05-07T12:00:00.000Z',
            publishedAt: '2026-05-07T12:00:00.000Z',
          },
          {
            id: 'shared-agent-release-coordinator',
            name: 'Release coordinator',
            description: 'Draft shared agent for coordinating verification gates and publish handoffs.',
            version: '0.1.0',
            status: 'draft',
            owner: 'Release Engineering',
            visibility: 'team',
            allowedRoles: ['publisher', 'admin'],
            sourceProvider: 'codex',
            capabilities: ['verification planning', 'PR handoff', 'status reporting'],
            toolScopes: ['github:pr', 'linear:issue', 'browser:screenshot'],
            updatedAt: '2026-05-07T12:30:00.000Z',
            publishedAt: null,
          },
        ],
        audit: [
          {
            id: 'shared-agent-team-reviewer:published:2026-05-07T12:00:00.000Z',
            agentId: 'shared-agent-team-reviewer',
            actor: 'Platform',
            action: 'published',
            summary: 'Published Team reviewer v1.2.0 for team discovery',
            createdAt: '2026-05-07T12:00:00.000Z',
          },
        ],
        usage: [
          {
            id: 'shared-agent-team-reviewer:session-review-1:2026-05-07T13:00:00.000Z',
            agentId: 'shared-agent-team-reviewer',
            sessionId: 'session-review-1',
            actor: 'Taylor User',
            createdAt: '2026-05-07T13:00:00.000Z',
          },
          {
            id: 'shared-agent-team-reviewer:session-review-2:2026-05-07T14:00:00.000Z',
            agentId: 'shared-agent-team-reviewer',
            sessionId: 'session-review-2',
            actor: 'Taylor User',
            createdAt: '2026-05-07T14:00:00.000Z',
          },
          {
            id: 'shared-agent-team-reviewer:session-review-3:2026-05-07T15:00:00.000Z',
            agentId: 'shared-agent-team-reviewer',
            sessionId: 'session-review-3',
            actor: 'Taylor User',
            createdAt: '2026-05-07T15:00:00.000Z',
          },
        ],
      }));
      localStorage.setItem('agent-browser.shared-session-control-state', JSON.stringify({
        enabled: true,
        allowRemoteControl: true,
        requirePairingConfirmation: true,
        activeSessions: [
          {
            sessionId: sessionId,
            workspaceName: 'Research',
            peerLabel: 'Maya',
            deviceLabel: 'iPad Pro',
            status: 'active',
            eventCount: 3,
            lastEventAt: '2026-05-07T21:31:00.000Z',
          },
        ],
        audit: [
          {
            id: `${sessionId}:pairing.confirmed:2026-05-07T21:31:00.000Z`,
            sessionId: sessionId,
            event: 'pairing.confirmed',
            actor: 'Maya',
            summary: 'Maya confirmed pairing for Maya on iPad Pro.',
            createdAt: '2026-05-07T21:31:00.000Z',
          },
        ],
      }));
      sessionStorage.setItem('agent-browser.session.active-workspace-id', JSON.stringify(workspaceId));
      sessionStorage.setItem('agent-browser.session.active-panel', JSON.stringify('workspaces'));
    });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(page).toHaveTitle('Agent Browser', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Omnibar')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Harness dashboard' })).toBeVisible({ timeout: shellTimeoutMs });
    const knowledgeWidget = page.getByRole('article', { name: 'Knowledge widget' });
    await expect(knowledgeWidget).toBeVisible({ timeout: shellTimeoutMs });
    await expect(knowledgeWidget.getByText('Surface: Launch dashboard surface (read, edit, rollback)')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await captureDashboardCanvasViewportMatrix(page, shellTimeoutMs);
    await page.setViewportSize({ width: 1280, height: 820 });
    const workspaceTree = page.getByRole('tree', { name: 'Workspace tree' });
    await expect(workspaceTree).toBeVisible({ timeout: shellTimeoutMs });
    await workspaceTree.getByRole('button', { name: 'Session summary', exact: true }).click();
    const widgetEditor = page.getByRole('region', { name: 'Widget editor' });
    await expect(widgetEditor).toBeVisible({ timeout: shellTimeoutMs });
    await expect(widgetEditor.getByRole('heading', { name: 'Session summary', level: 2 })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(widgetEditor.getByRole('region', { name: 'Widget source editors' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(widgetEditor.getByRole('region', { name: 'Live widget preview' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(widgetEditor.getByRole('region', { name: 'Widget change history' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: widgetEditorOutputPath, fullPage: true });
    await page.evaluate((activeWorkspaceId) => {
      const key = 'agent-browser.workspace-view-state-by-workspace';
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      current[activeWorkspaceId] = {
        ...(current[activeWorkspaceId] || {}),
        dashboardOpen: true,
        activeDashboardWidgetId: null,
        activeSessionIds: [],
        openTabIds: [],
        editingFilePath: null,
        activeArtifactPanel: null,
        panelOrder: [`dashboard:${activeWorkspaceId}`],
      };
      localStorage.setItem(key, JSON.stringify(current));
    }, 'ws-research');
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(page.getByRole('region', { name: 'Harness dashboard' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(workspaceTree).toBeVisible({ timeout: shellTimeoutMs });
    await workspaceTree.getByRole('button', { name: 'Evaluation session', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enable browser notifications' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    const sharedControlBanner = page.getByLabel('Shared session remote control');
    await expect(sharedControlBanner).toBeVisible({ timeout: shellTimeoutMs });
    await expect(sharedControlBanner).toContainText('Maya', { timeout: shellTimeoutMs });
    await expect(sharedControlBanner).toContainText('iPad Pro', { timeout: shellTimeoutMs });
    await expect(sharedControlBanner).toContainText('Remote control enabled', { timeout: shellTimeoutMs });
    await expect(sharedControlBanner).toContainText('3 signed events', { timeout: shellTimeoutMs });
    await expect(page.getByText('Choose how the agent should continue.').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByLabel('Notes')).toHaveValue('Prefer official docs', { timeout: shellTimeoutMs });
    await expect(page.getByRole('combobox', { name: 'Urgency' })).toHaveValue('soon', { timeout: shellTimeoutMs });
    await expect(page.getByRole('checkbox', { name: 'Notify me' })).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByRole('spinbutton', { name: 'Result count' })).toHaveValue('3', {
      timeout: shellTimeoutMs,
    });
    await page.getByRole('button', { name: /Approval before deployment|Process.*3 events/ }).click();
    const checkpointStrip = page.getByLabel('Suspended checkpoint');
    await expect(checkpointStrip).toBeVisible({ timeout: shellTimeoutMs });
    await expect(checkpointStrip.getByText('Approval before deployment')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(checkpointStrip.getByText('resume:visual-eval-session:2026-05-07T02:30:00.000Z')).toBeVisible({
      timeout: shellTimeoutMs,
    });
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
    await page.getByRole('button', { name: 'Models', exact: true }).click({ noWaitAfter: true });
    await expect(page.getByRole('region', { name: 'Installed models' }).getByRole('heading', { name: 'Models', exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Model catalog' }).getByRole('heading', { name: 'Find the Right Model for Your AI Solution' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible({ timeout: shellTimeoutMs });
    const historyGraph = page.getByRole('region', { name: 'Workspace git graph' });
    await expect(historyGraph).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Scrollable workspace history')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('button', { name: 'Move back on workspace history timeline' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(historyGraph.getByText(/App actions: Opened Models/).first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('File change: notes.md')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('Approval before deployment').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText(/operator approval/i).first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('Squash merge: Agent proof branch')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('conversation/research/agent-proof', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('SDK launch smoke')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('Daily workspace audit').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyGraph.getByText('Squash merge: Evaluation session')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByRole('button', { name: 'Suspend/resume checkpoints' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Branching conversations' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Typed run SDK' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chaptered sessions' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scheduled automations' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open history detail for Squash merge: Evaluation session' }).click();
    await expect(page.getByRole('region', { name: 'Selected history detail' }).getByText('Read-only chat')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByLabel('Read-only chat session').getByText('Captured visual evidence and completed the run.')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.getByRole('button', { name: 'Open history detail for File change: notes.md' }).click();
    await expect(page.getByRole('region', { name: 'Selected history detail' }).getByText('Read-only file')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText(/Materialized from CRDT snapshot/)).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Read-only file version')).toContainText(/draft\s+ready/, { timeout: shellTimeoutMs });
    await page.screenshot({ path: historyTimelineOutputPath, fullPage: true });
    const historyDetail = page.getByRole('region', { name: 'Selected history detail' });
    await historyGraph.getByRole('button', { name: /Inspect branch history for App actions: Opened Models/ }).click();
    await expect(historyDetail.getByText('Opened History').first()).toBeVisible({ timeout: shellTimeoutMs });
    await historyGraph.getByRole('button', { name: 'Inspect branch history for Squash merge: Agent proof branch' }).click();
    await expect(historyDetail.getByText('Captured branch proof and returned the latest summary to main.').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await historyGraph.getByRole('button', { name: 'Inspect branch history for SDK launch smoke' }).click();
    await expect(historyDetail.getByText('Structured event stream is live.')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyDetail.getByText('Reconnect cursor 3 is ready for clients.')).toBeVisible({ timeout: shellTimeoutMs });
    await historyGraph.getByRole('button', { name: 'Inspect branch history for Squash merge: Evaluation session' }).click();
    await expect(historyDetail.getByText(/evidence:output\/playwright\/agent-browser-visual-smoke\.png/)).toBeVisible({ timeout: shellTimeoutMs });
    await expect(historyDetail.getByText(/tool-output:visual-tool/)).toBeVisible({ timeout: shellTimeoutMs });
    await historyGraph.getByRole('button', { name: 'Inspect branch history for Daily workspace audit' }).click();
    await expect(historyDetail.getByText(/next run: 2026-05-06T09:00:00.000Z/)).toBeVisible({ timeout: shellTimeoutMs });
    await page.screenshot({ path: typedSdkOutputPath, fullPage: true });
    await page.getByRole('button', { name: 'Models', exact: true }).click({ noWaitAfter: true });
    const installedModelsPanel = page.getByRole('region', { name: 'Installed models' });
    const modelCatalog = page.getByRole('region', { name: 'Model catalog' });
    await expect(installedModelsPanel.getByRole('heading', { name: 'Models', exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(modelCatalog.getByRole('heading', { name: 'Find the Right Model for Your AI Solution' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(modelCatalog.getByRole('heading', { name: /Codex Models \(\d+\)/ })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(modelCatalog.getByRole('heading', { name: /Local Browser Models \(\d+\)/ })).toBeVisible({ timeout: shellTimeoutMs });
    await page.getByRole('button', { name: 'Settings', exact: true }).click({ noWaitAfter: true });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: shellTimeoutMs });
    const settingToggle = (name) => page.getByRole('button', { name, exact: true });
    const harnessCoreToggle = settingToggle('Harness core');
    if (await harnessCoreToggle.getAttribute('aria-expanded') === 'false') {
      await harnessCoreToggle.click();
    }
    await expect(page.getByText('Core active')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('thread lifecycle', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('event streaming', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Harness steering').click();
    await expect(page.getByLabel('Enable harness steering')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Auto-capture steering corrections')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('.steering/STEERING.md', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('.steering/tool.steering.md', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Harness evolution').click();
    await expect(page.getByLabel('Enable harness evolution')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Fallback to safe mode on failure')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Require visual validation')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Harness evolution sandbox root')).toHaveValue('.harness-evolution/sandboxes', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Harness evolution patch command')).toHaveValue('npx patch-package', { timeout: shellTimeoutMs });
    await settingToggle('Persistent memory graphs').click();
    const persistentMemoryGraphSection = page
      .locator('section.settings-section')
      .filter({ has: settingToggle('Persistent memory graphs') });
    await expect(persistentMemoryGraphSection.getByText('WASM-compatible local graph')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(persistentMemoryGraphSection.getByRole('button', { name: 'Load sample memory' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await persistentMemoryGraphSection.getByRole('button', { name: 'Load sample memory' }).click();
    await persistentMemoryGraphSection.getByLabel('Memory graph question').fill('How does Kuzu-WASM support offline retrieval?');
    await persistentMemoryGraphSection.getByRole('button', { name: 'Search Memory' }).click();
    await expect(persistentMemoryGraphSection.getByText('MEMORY SUMMARY')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(persistentMemoryGraphSection.getByText('Kuzu-WASM').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(persistentMemoryGraphSection.getByRole('img', { name: 'Retrieved memory graph' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await persistentMemoryGraphSection.screenshot({ path: persistentMemoryGraphOutputPath });
    await settingToggle('Benchmark routing').click();
    await expect(page.getByRole('checkbox', { name: /benchmark routing/i })).toBeVisible({ timeout: shellTimeoutMs });
    const benchmarkObjective = page.getByLabel('Benchmark routing objective');
    await expect(benchmarkObjective).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText(/Fallback priors|benchmark source|Refreshing evidence/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await settingToggle('Workspace skill policies').click();
    await expect(page.getByLabel('Enable workspace skill policies')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Least-privilege enforcement')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Versioned packages')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Policy-aware regex grep')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('listitem').filter({ has: page.getByText('Team reviewer', { exact: true }) })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await settingToggle('Shared agents').click();
    await expect(page.getByLabel('Enable shared-agent registry')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('1 published · 1 draft · 3 usage events', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('listitem').filter({ has: page.getByText('Release coordinator', { exact: true }) })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: sharedAgentsOutputPath, fullPage: true });
    await settingToggle('Browser workflow skills').click();
    await expect(page.getByText('Repeatable browser workflows')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('list', { name: 'Installable browser workflow skills' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText('Visual review workflow').first()).toBeVisible({ timeout: shellTimeoutMs });
    const visualReviewWorkflowCard = page
      .getByRole('list', { name: 'Installable browser workflow skills' })
      .getByRole('listitem')
      .filter({ has: page.getByText('Visual review workflow', { exact: true }) });
    const visualReviewInstallButton = visualReviewWorkflowCard.getByRole('button', { name: 'Install' });
    await visualReviewInstallButton.scrollIntoViewIfNeeded();
    await visualReviewInstallButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('list', { name: 'Installed browser workflow skills' }).getByText('browser-screenshot')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByRole('list', { name: 'Installed browser workflow skills' }).getByText('npm.cmd run visual:agent-browser')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await settingToggle('Branching conversations').click();
    await expect(page.getByLabel('Enable conversation branching')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Inject branch summaries into prompt context')).toBeChecked({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText('Process graph branch nodes')).toBeVisible({ timeout: shellTimeoutMs });

    await settingToggle('Spec-driven development').click();
    await expect(page.getByLabel('Enable spec-driven development')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Default spec format')).toHaveValue('json-schema', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Resolve ambiguities before implementation')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Require tests or evals from spec')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.locator('.spec-driven-development-summary-card').getByText('JSON Schema 2020-12')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page
      .locator('section.settings-section')
      .filter({ has: settingToggle('Spec-driven development') })
      .screenshot({ path: specDrivenDevelopmentOutputPath });

    await settingToggle('Media agent').click();
    await expect(page.getByText('Media orchestration')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('list', { name: 'Media generation workflows' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText('Image generation', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Voice generation', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('SFX generation', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Music generation', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Remotion video', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await page.waitForTimeout(250);
    await page
      .locator('section.settings-section')
      .filter({ has: settingToggle('Media agent') })
      .screenshot({ path: mediaAgentOutputPath });
    await settingToggle('Partner agent control plane').click();
    await expect(page.getByLabel('Enable partner-agent control plane')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Partner-agent audit level')).toHaveValue('standard', { timeout: shellTimeoutMs });
    await expect(page.getByText('Unified workflow')).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Runtime plugins').click();
    await expect(page.getByLabel('Enable runtime plugins')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Tool-call interception mode')).toHaveValue('observe', { timeout: shellTimeoutMs });
    await expect(page.getByText(/active plugins/i).first()).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Browser-agent run SDK').click();
    await expect(page.getByText('Structured event stream')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Reconnect cursor')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Archive and delete lifecycle')).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('n8n capabilities').click();
    await expect(page.getByText('CNCF Serverless Workflow 1.0.3')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Workflow canvas')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('Executions and debugging')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('AI, RAG, and evaluations')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('manualTrigger')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('runLocalAction')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByText('queueReview')).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Graph knowledge').click();
    const graphKnowledgeSection = page
      .locator('section.settings-section')
      .filter({ has: settingToggle('Graph knowledge') });
    await expect(graphKnowledgeSection.getByRole('status').filter({ hasText: 'Offline-ready graph memory' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(graphKnowledgeSection.getByRole('button', { name: 'Load Sample Memory', exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(graphKnowledgeSection.getByRole('button', { name: 'Generate Context Pack', exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(graphKnowledgeSection.getByLabel('Graph knowledge search query')).toHaveValue(
      'offline graph memory PathRAG Kuzu-WASM',
      { timeout: shellTimeoutMs },
    );
    await expect(graphKnowledgeSection.getByText('Tier 1 blocks')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(graphKnowledgeSection.getByText('Tier 2 nodes')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(graphKnowledgeSection.getByText('Kuzu-WASM').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(graphKnowledgeSection.getByLabel('Graph knowledge context pack')).toContainText('PATHS', {
      timeout: shellTimeoutMs,
    });
    await graphKnowledgeSection.getByRole('tab', { name: 'Paths' }).click();
    await expect(graphKnowledgeSection.getByText(/Matched query seed Kuzu-WASM/i).first()).toBeVisible({ timeout: shellTimeoutMs });
    await graphKnowledgeSection.getByRole('tab', { name: 'Communities' }).click();
    await expect(graphKnowledgeSection.getByText('Offline graph memory').first()).toBeVisible({ timeout: shellTimeoutMs });
    await page.waitForTimeout(250);
    await page.screenshot({ path: graphKnowledgeOutputPath, fullPage: true });
    await settingToggle('Adversary tool review').click();
    await expect(page.getByLabel('Enable adversary tool-call review')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Strictly block high-risk reviewed actions')).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Adversary agent').click();
    await expect(page.getByLabel('Enable adversary candidate generation')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Maximum adversary candidates')).toHaveValue('3', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Rerun when adversary output wins')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Preserve judge feedback in AgentBus')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Hide adversary labels from voters')).toBeChecked({ timeout: shellTimeoutMs });
    await settingToggle('Security review agents').click();
    await expect(page.getByLabel('Enable security review agents')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Enable inline PR security review')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Enable scheduled vulnerability scans')).toBeVisible({ timeout: shellTimeoutMs });
    await settingToggle('Suspend/resume checkpoints').click();
    await expect(page.getByLabel('Default checkpoint timeout')).toHaveValue('240', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Require operator confirmation before resume')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByText('resume:visual-eval-session:2026-05-07T02:30:00.000Z')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await settingToggle('Chaptered sessions').click();
    await expect(page.getByLabel('Enable chaptered sessions')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Automatic context compression')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Render compacted context summaries')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Cache large tool outputs')).toBeChecked({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Context manager mode')).toHaveValue('standard', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Chapter compression target tokens')).toHaveValue('1200', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Inline tool-output cache token limit')).toHaveValue('800', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('File tool-output cache token threshold')).toHaveValue('2400', { timeout: shellTimeoutMs });
    await expect(page.getByText(/1 session\s+.\s+1 chapter\s+.\s+\d+ audit events?/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await settingToggle('Scheduled automations').click();
    await expect(page.getByLabel('Enable Daily workspace audit')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByLabel('Daily workspace audit cadence')).toHaveValue('daily', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Daily workspace audit retry count')).toHaveValue('1', { timeout: shellTimeoutMs });
    await expect(page.getByLabel('Daily workspace audit notification route')).toHaveValue('inbox', {
      timeout: shellTimeoutMs,
    });
    await settingToggle('Benchmark routing').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Symphony', exact: true }).click();
    const symphonyApp = page.getByRole('region', { name: 'Symphony task management system' });
    const symphonySidePanel = page.getByRole('region', { name: 'Symphony activity summary' });
    await expect(symphonyApp).toBeVisible({ timeout: shellTimeoutMs });
    await expect(symphonySidePanel).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonySidePanel).toContainText('Current phase', { timeout: shellTimeoutMs });
    await expect(symphonySidePanel).toContainText('Idle', { timeout: shellTimeoutMs });
    await expect(symphonySidePanel).not.toContainText('State store', { timeout: shellTimeoutMs });
    await expect(symphonySidePanel).not.toContainText('IndexedDB', { timeout: shellTimeoutMs });
    await expect(symphonySidePanel).not.toContainText('agent/research/tests-2', { timeout: shellTimeoutMs });
    await expect(symphonySidePanel.getByRole('button')).toHaveCount(0, { timeout: shellTimeoutMs });
    await expect(symphonyApp.getByRole('heading', { name: 'Agent Workspaces' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('heading', { name: 'Isolated Workspaces' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('heading', { name: 'Review Gate' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp).toContainText('No active Symphony task', { timeout: shellTimeoutMs });
    await expect(symphonyApp).not.toContainText('Running', { timeout: shellTimeoutMs });
    await expect(symphonyApp).not.toContainText('Slots', { timeout: shellTimeoutMs });

    await symphonyApp.getByLabel('Symphony task request').fill('parallelize frontend, tests, and documentation work');
    await symphonyApp.getByRole('button', { name: 'Start Symphony task' }).click();
    await expect(symphonyApp.getByRole('navigation', { name: 'Symphony projects' })).toContainText('Projects', {
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('button', { name: 'Open project Research' })).toHaveAttribute('aria-current', 'page', {
      timeout: shellTimeoutMs,
    });
    const symphonyQueue = symphonyApp.getByRole('region', { name: 'Symphony work queue' });
    await expect(symphonyQueue).toContainText('Work queue', { timeout: shellTimeoutMs });
    await symphonyQueue.getByLabel('New task title').fill('Add smoke proof');
    await symphonyQueue.getByRole('button', { name: 'Create Symphony task' }).click();
    await expect(symphonyQueue.getByRole('button', { name: 'Open task SYM-004 Add smoke proof' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('region', { name: 'Symphony task detail' })).toContainText('Add smoke proof', {
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('button', { name: 'Open task SYM-001 Frontend branch' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByText(/SYM-001/).first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByText('Queued').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await symphonyApp.getByRole('button', { name: 'Start agent session for agent/research/frontend-1' }).click();
    await expect(symphonyApp.getByRole('button', { name: 'Stop agent session for agent/research/frontend-1' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await symphonyApp.getByRole('button', { name: 'Stop agent session for agent/research/frontend-1' }).click();
    await expect(symphonyApp.getByRole('button', { name: 'Start agent session for agent/research/frontend-1' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('button', { name: /Cancel task/ })).toHaveCount(0);
    await symphonyApp.getByRole('button', { name: 'Close task and dispose workspace for agent/research/documentation-3' }).click();
    await expect(symphonyApp.getByText('agent/research/documentation-3', { exact: true })).toHaveCount(0, {
      timeout: shellTimeoutMs,
    });
    await expect(symphonyApp.getByRole('button', { name: 'agent/research/frontend-1 is not ready for merge approval' })).toHaveCount(0);
    await expect(symphonyApp.getByRole('button', { name: 'Reviewer agent waiting for agent/research/frontend-1 to finish' })).toHaveCount(0);
    await expect(symphonyApp.getByRole('button', { name: /Start rework/ })).toHaveCount(0);
    await expect(symphonyApp.getByRole('button', { name: /Explain highest risk group/ })).toHaveCount(0);
    await symphonyApp.screenshot({ path: symphonyOutputPath });
    await page.getByRole('button', { name: 'History', exact: true }).click();
    const historyPanelAfterSymphony = page.getByRole('region', { name: 'History', exact: true });
    await expect(historyPanelAfterSymphony).toContainText('Symphony activity: Updated Symphony', { timeout: shellTimeoutMs });
    await historyPanelAfterSymphony
      .getByRole('button', { name: /Inspect branch history for Symphony activity: Updated Symphony/ })
      .first()
      .click();
    await expect(historyPanelAfterSymphony).toContainText(
      'Symphony event: workflow loaded - Loaded WORKFLOW.md and applied Symphony runtime defaults.',
      { timeout: shellTimeoutMs },
    );
    await expect(historyPanelAfterSymphony).toContainText(
      'Symphony session: SYM-001 agent/research/frontend-1 StreamingTurn active 1 turn',
      { timeout: shellTimeoutMs },
    );
    await expect(historyPanelAfterSymphony).toContainText(
      'Symphony session: SYM-001 agent/research/frontend-1 CanceledByReconciliation stopped no live session',
      { timeout: shellTimeoutMs },
    );
    await page.getByRole('button', { name: 'Extensions', exact: true }).click();
    const installedExtensions = page.getByRole('region', { name: 'Installed extensions' });
    await expect(installedExtensions.getByRole('heading', { name: 'Installed extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(installedExtensions.getByText('1 installed').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(installedExtensions.getByText('Workspace plugin')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(installedExtensions.getByText('Workspace plugins')).toHaveCount(0);
    const marketplace = page.getByRole('region', { name: 'Extension marketplace' });
    await expect(marketplace.getByRole('heading', { name: 'Marketplace' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByText('19 extensions')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByRole('heading', { name: 'IDE extensions' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(marketplace.getByRole('heading', { name: 'Harness extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('heading', { name: 'Worker extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('heading', { name: 'Provider extensions' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Symphony internal task orchestration').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Design Studio').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Requires DESIGN.md agent guidance').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Artifact worktree explorer').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Requires Artifact context').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByText('Unavailable on this runtime').first()).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(marketplace.getByRole('button', { name: 'Install Symphony internal task orchestration' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: marketplaceOutputPath, fullPage: true });
    await marketplace.getByRole('button', { name: 'Install Artifact context' }).click();
    await expect(marketplace.getByRole('button', { name: 'Install Artifact worktree explorer' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await marketplace.getByRole('button', { name: 'Install Artifact worktree explorer' }).click();
    await expect(page.getByRole('button', { name: 'Artifact worktree explorer extension' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(workspaceTree).toBeVisible({ timeout: shellTimeoutMs });
    await expect(workspaceTree.getByRole('treeitem', { name: /^Artifacts/ })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(workspaceTree.getByRole('treeitem', { name: /^Launch dashboard/ })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(workspaceTree.getByRole('treeitem', { name: /\/\/artifacts/ })).toHaveCount(0);
    await workspaceTree.getByRole('button', { name: /^Launch dashboard/ }).click();
    await workspaceTree.getByRole('button', { name: 'dashboard.md', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Artifact viewer' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(page.getByText('//artifacts/artifact-ws-research-dashboard/dashboard.md')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: artifactWorktreeOutputPath, fullPage: true });
    await page.getByRole('button', { name: 'Extensions', exact: true }).click();
    await marketplace.getByRole('button', { name: 'Open details for Design Studio' }).click();
    const extensionDetail = page.getByRole('region', { name: 'Extension detail' });
    await expect(extensionDetail).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionDetail.getByRole('heading', { name: 'Design Studio' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(extensionDetail.getByRole('heading', { name: 'README.md' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionDetail.getByLabel('Extension metadata').getByText('Identifier')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: extensionDetailOutputPath, fullPage: true });
    await extensionDetail.getByRole('button', { name: 'Install Design Studio' }).click();
    await page.getByRole('button', { name: 'Design Studio extension' }).click();
    const designProjectsPanel = page.getByRole('region', { name: 'Design Studio projects' });
    await expect(designProjectsPanel).toBeVisible({ timeout: shellTimeoutMs });
    await expect(page.getByRole('region', { name: 'Installed extensions' })).toHaveCount(0);
    const extensionFeaturePane = page.getByRole('region', { name: 'Design Studio feature pane' });
    await expect(extensionFeaturePane).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionFeaturePane.getByRole('heading', { name: 'Design Studio' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(extensionFeaturePane.getByLabel('Design brief')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionFeaturePane.getByLabel('Design Studio preview')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionFeaturePane.getByLabel('Design Studio token rail')).toBeVisible({ timeout: shellTimeoutMs });
    await extensionFeaturePane.getByRole('tab', { name: 'Show token review' }).click();
    const tokenReview = extensionFeaturePane.getByRole('region', { name: 'Design Studio token review' });
    await expect(tokenReview).toBeVisible({ timeout: shellTimeoutMs });
    await expect(tokenReview.getByLabel('Design Studio approval summary')).toContainText('0/6 approved', {
      timeout: shellTimeoutMs,
    });
    await expect(tokenReview.getByLabel('Design Studio approval composition sample')).toContainText(
      'Agent Browser approval composition',
      { timeout: shellTimeoutMs },
    );
    await expect(tokenReview.getByLabel('Display type visual sample')).toContainText('Aa', {
      timeout: shellTimeoutMs,
    });
    await expect(tokenReview.getByLabel('Action components visual sample')).toContainText('Run', {
      timeout: shellTimeoutMs,
    });
    const approveTokenButtons = tokenReview.getByRole('button', { name: /^Approve / });
    const approveTokenButtonCount = await approveTokenButtons.count();
    for (let index = 0; index < approveTokenButtonCount; index += 1) {
      await approveTokenButtons.nth(index).click();
    }
    await expect(tokenReview.getByLabel('Design Studio approval summary')).toContainText('6/6 approved', {
      timeout: shellTimeoutMs,
    });
    await tokenReview.getByLabel('Publish approved Design Studio system').check();
    await tokenReview.getByLabel('Use Design Studio system as workspace default').check();
    await tokenReview.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: openDesignTokenReviewOutputPath, fullPage: true });
    await captureOpenDesignTokenReviewViewportMatrix(page, tokenReview, shellTimeoutMs);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await extensionFeaturePane.getByRole('button', { name: 'Compile DESIGN.md' }).click();
    await expect(extensionFeaturePane.getByRole('region', { name: 'Design Studio generated files' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(extensionFeaturePane.getByText('DESIGN.md').first()).toBeVisible({ timeout: shellTimeoutMs });
    await expect(extensionFeaturePane.getByText('//artifacts/design-studio-research-design-system/research.json')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(extensionFeaturePane.getByText('//artifacts/design-studio-research-design-system/token-review.json')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await extensionFeaturePane.getByRole('button', { name: 'Run design critique' }).click();
    await expect(extensionFeaturePane.getByRole('region', { name: 'Design Studio critique' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(extensionFeaturePane.getByText('Gate pass')).toBeVisible({ timeout: shellTimeoutMs });
    await page.screenshot({ path: extensionFeatureOutputPath, fullPage: true });
    await page.getByRole('button', { name: 'Extensions', exact: true }).click();
    const workflowMarketplace = page.getByRole('region', { name: 'Extension marketplace' });
    await expect(workflowMarketplace).toBeVisible({ timeout: shellTimeoutMs });
    await workflowMarketplace.getByRole('button', { name: 'Install Workflow canvas orchestration' }).click();
    await page.getByRole('button', { name: 'Workflow canvas orchestration extension' }).click();
    const workflowFeaturePane = page.getByRole('region', { name: 'Workflow canvas orchestration feature pane' });
    const workflowWorkbench = workflowFeaturePane.getByRole('region', { name: 'Workflow canvas workbench' });
    await expect(workflowWorkbench).toBeVisible({ timeout: shellTimeoutMs });
    await expect(workflowFeaturePane.getByTestId('workflow-canvas-plugin-renderer')).toHaveAttribute(
      'data-plugin-id',
      'agent-harness.ext.workflow-canvas',
      { timeout: shellTimeoutMs },
    );
    await expect(workflowWorkbench.getByRole('region', { name: 'Workflow node catalog' }).getByText('Webhook trigger')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    const workflowCanvas = workflowWorkbench.getByRole('region', { name: 'Workflow orchestration canvas' });
    await expect(workflowCanvas.getByRole('button', { name: 'Inspect Research agent' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(workflowCanvas.getByText('OpenAI typed edge')).toBeVisible({ timeout: shellTimeoutMs });
    await workflowCanvas.getByRole('button', { name: 'Inspect Generate campaign media' }).click();
    const workflowInspector = workflowWorkbench.getByRole('region', { name: 'Workflow node inspector' });
    await expect(workflowInspector).toContainText('Generate campaign media', { timeout: shellTimeoutMs });
    await expect(workflowInspector).toContainText('Credit estimate', { timeout: shellTimeoutMs });
    await workflowWorkbench.getByRole('button', { name: 'Run workflow' }).click();
    await expect(workflowWorkbench.getByRole('region', { name: 'Workflow execution replay' })).toContainText('Run complete', {
      timeout: shellTimeoutMs,
    });
    await workflowWorkbench.getByRole('button', { name: 'Save canvas artifact' }).click();
    await expect(workflowWorkbench.getByRole('status', { name: 'Workflow canvas save status' })).toContainText(
      'Saved workflow-canvas/campaign-launch.json',
      { timeout: shellTimeoutMs },
    );
    await page.screenshot({ path: workflowCanvasOutputPath, fullPage: true });
    await page.getByRole('button', { name: 'Wiki', exact: true }).click();
    const repoWikiPanel = page.getByRole('region', { name: 'Wiki explorer', exact: true });
    const repoWikiWorkbench = page.getByRole('region', { name: 'Workspace knowledgebase wiki', exact: true });
    await expect(repoWikiPanel).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Files', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Sessions', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Citations', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Wiki Pages', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Knowledge Graph', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('Memory', { timeout: shellTimeoutMs });
    await expect(repoWikiPanel).not.toContainText('wiki:ws-research:workspace-map', { timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.locator('.repo-wiki-workbench-title')).not.toContainText('stored files', {
      timeout: shellTimeoutMs,
    });
    const repoWikiViewTabs = repoWikiWorkbench.getByRole('tablist', { name: 'Wiki views' });
    await expect(repoWikiViewTabs.getByRole('tab', { name: 'Wiki Pages' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiViewTabs.getByRole('tab', { name: 'Knowledge Graph' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiPanel.getByRole('button', { name: 'Refresh wiki' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiWorkbench.getByRole('heading', { name: 'Workspace wiki' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiWorkbench.getByRole('search', { name: 'Wiki search' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiWorkbench.getByLabel('Search wiki pages and memories')).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.getByRole('heading', { name: 'Repo map' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.getByText('wiki:ws-research:workspace-map')).toBeVisible({ timeout: shellTimeoutMs });
    await repoWikiWorkbench.getByLabel('Search wiki pages and memories').fill('capability');
    await expect(repoWikiWorkbench.getByRole('heading', { name: 'Capability files' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.getByRole('button', { name: 'Open Runtime surfaces' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.getByRole('complementary', { name: 'Page context' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.screenshot({ path: repoWikiPagesOutputPath, fullPage: true });
    await repoWikiViewTabs.getByRole('tab', { name: 'Knowledge Graph' }).click();
    const repoWikiGraphPanel = repoWikiWorkbench.getByRole('tabpanel', { name: 'Knowledge Graph' });
    await expect(repoWikiGraphPanel).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiGraphPanel.getByRole('heading', { name: 'Modeled knowledge relationships' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('button', { name: 'All knowledge' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('button', { name: 'Nearby' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('button', { name: 'Isolated chunks' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByLabel('Graph relationship lines')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('complementary', { name: 'Graph inspector' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('heading', { name: 'Incoming relationships', exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('heading', { name: 'Outgoing relationships', exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('heading', { name: 'Unlinked mentions', exact: true })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiGraphPanel.getByRole('button', { name: 'Select graph node Repo map' })).toBeVisible({ timeout: shellTimeoutMs });
    await repoWikiGraphPanel.getByRole('button', { name: 'Nearby' }).click();
    await expect(repoWikiGraphPanel.getByRole('button', { name: 'Nearby' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: shellTimeoutMs },
    );
    await page.screenshot({ path: repoWikiGraphOutputPath, fullPage: true });
    await repoWikiViewTabs.getByRole('tab', { name: 'Memory' }).click();
    const repoWikiMemoryPanel = repoWikiWorkbench.getByRole('tabpanel', { name: 'Memory' });
    await expect(repoWikiMemoryPanel).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiMemoryPanel.getByRole('region', { name: 'Memory management console' })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiMemoryPanel.getByRole('heading', { name: 'Stored memories' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiMemoryPanel.getByRole('region', { name: 'Memory scopes' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiMemoryPanel.getByRole('region', { name: 'Memory library' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiMemoryPanel.getByRole('region', { name: 'Add memory' })).toBeVisible({ timeout: shellTimeoutMs });
    const clearMemorySearchButton = repoWikiMemoryPanel.getByRole('button', { name: 'Clear memory search filter' });
    await expect(clearMemorySearchButton).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await clearMemorySearchButton.click();
    await expect(repoWikiMemoryPanel.getByText('No stored memories match "capability".')).toHaveCount(0);
    await expect(repoWikiMemoryPanel.getByLabel('Memory scope', { exact: true })).toBeVisible({ timeout: shellTimeoutMs });
    await repoWikiMemoryPanel
      .getByLabel('Memory text')
      .fill('Repository wiki search belongs inside wiki pages, with citations shown in page context.');
    await repoWikiMemoryPanel.getByRole('button', { name: 'Remember' }).click();
    await expect(repoWikiMemoryPanel.getByText('Repository wiki search belongs inside wiki pages, with citations shown in page context.')).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiMemoryPanel.getByText(/hot · \.memory\/workspace\.memory\.md/)).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await expect(repoWikiMemoryPanel.getByRole('button', { name: /Forget memory: Repository wiki search belongs inside wiki pages/ })).toBeVisible({
      timeout: shellTimeoutMs,
    });
    await page.screenshot({ path: repoWikiMemoryOutputPath, fullPage: true });
    await page.screenshot({ path: repoWikiOutputPath, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(repoWikiWorkbench).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiWorkbench.getByRole('search', { name: 'Wiki search' })).toBeVisible({ timeout: shellTimeoutMs });
    await expect(repoWikiMemoryPanel.getByRole('heading', { name: 'Stored memories' })).toBeVisible({ timeout: shellTimeoutMs });
    await page.screenshot({ path: repoWikiMobileOutputPath, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.evaluate(() => {
      sessionStorage.setItem('agent-browser.session.active-panel', JSON.stringify('workspaces'));
    });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await expect(workspaceTree).toBeVisible({ timeout: shellTimeoutMs });
    await workspaceTree.getByRole('button', { name: 'Evaluation session', exact: true }).click();
    await page.getByRole('tab', { name: 'Terminal mode' }).click();
    const bashInput = page.getByLabel('Bash input');
    await expect(bashInput).toBeVisible({ timeout: shellTimeoutMs });
    await bashInput.fill('git init');
    await bashInput.press('Enter');
    await expect(page.getByLabel('Terminal output')).toContainText('Initialized empty git-stub repository', {
      timeout: shellTimeoutMs,
    });
    await bashInput.fill('git status --short');
    await bashInput.press('Enter');
    await expect(page.getByLabel('Terminal output')).toContainText('?? settings.json', { timeout: shellTimeoutMs });
    await page.screenshot({ path: gitStubOutputPath, fullPage: true });
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`agent-browser visual smoke passed: ${outputPath}`);
    console.log(`agent-browser extensions marketplace smoke passed: ${marketplaceOutputPath}`);
    console.log(`agent-browser artifact worktree smoke passed: ${artifactWorktreeOutputPath}`);
    console.log(`agent-browser Design Studio token review smoke passed: ${openDesignTokenReviewOutputPath}`);
    console.log(`agent-browser workflow canvas smoke passed: ${workflowCanvasOutputPath}`);
    console.log(`agent-browser evaluation observability smoke passed: ${evaluationOutputPath}`);
    console.log(`agent-browser repository wiki smoke passed: ${repoWikiOutputPath}`);
    console.log(`agent-browser dashboard canvas smoke passed: ${dashboardCanvasOutputPath}`);
    console.log(`agent-browser widget editor smoke passed: ${widgetEditorOutputPath}`);
    console.log(`agent-browser git stub smoke passed: ${gitStubOutputPath}`);
    console.log(`agent-browser history timeline smoke passed: ${historyTimelineOutputPath}`);
    console.log(`agent-browser typed run SDK smoke passed: ${typedSdkOutputPath}`);
    console.log(`agent-browser spec-driven development smoke passed: ${specDrivenDevelopmentOutputPath}`);
    console.log(`agent-browser persistent memory graphs smoke passed: ${persistentMemoryGraphOutputPath}`);
    console.log(`agent-browser shared agents smoke passed: ${sharedAgentsOutputPath}`);
    console.log(`agent-browser symphony system smoke passed: ${symphonyOutputPath}`);
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
