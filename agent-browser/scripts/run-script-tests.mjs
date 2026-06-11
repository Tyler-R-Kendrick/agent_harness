import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';
import {
  buildGitLsFilesInvocation,
  filterExistingTrackedFiles,
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
  readTrackedFilesFromGitIndex,
  readTrackedFilesFromLineInput,
} from '../../scripts/check-generated-files-clean.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

async function readScript(relativePath) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function discoverPublicExtensionDocs(rootDir) {
  const extensionRoot = path.join(rootDir, 'ext');
  const extensionKinds = await readdir(extensionRoot, { withFileTypes: true });
  const extensionDocs = [];

  for (const kind of extensionKinds) {
    if (!kind.isDirectory()) continue;
    const kindDirectory = path.join(extensionRoot, kind.name);
    const packages = await readdir(kindDirectory, { withFileTypes: true });
    for (const pkg of packages) {
      if (!pkg.isDirectory()) continue;
      const packageDirectory = path.join(kindDirectory, pkg.name);
      const packageJsonPath = path.join(packageDirectory, 'package.json');
      const readmePath = path.join(packageDirectory, 'README.md');
      if (!(await pathExists(packageJsonPath)) || !(await pathExists(readmePath))) continue;

      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      if (packageJson.private) continue;

      extensionDocs.push({
        packageName: packageJson.name,
        readmePath: path.relative(rootDir, readmePath).replaceAll('\\', '/'),
      });
    }
  }

  return extensionDocs.sort((left, right) => left.readmePath.localeCompare(right.readmePath));
}

async function createPackageFixture(rootDir, packageName, packageJson) {
  const packageDir = packageName.startsWith('@')
    ? path.join(rootDir, 'node_modules', ...packageName.split('/'))
    : path.join(rootDir, 'node_modules', packageName);
  await mkdir(packageDir, { recursive: true });
  await writeJson(path.join(packageDir, 'package.json'), { name: packageName, version: '1.0.0', ...packageJson });
  return packageDir;
}

function createGitIndex(paths) {
  const header = Buffer.alloc(12);
  header.write('DIRC', 0, 'ascii');
  header.writeUInt32BE(2, 4);
  header.writeUInt32BE(paths.length, 8);

  const entries = paths.map((filePath) => {
    const filePathBytes = Buffer.from(filePath);
    const fixedFields = Buffer.alloc(62);
    fixedFields.writeUInt16BE(Math.min(filePathBytes.length, 0x0fff), 60);

    const unpaddedLength = fixedFields.length + filePathBytes.length + 1;
    const paddedLength = Math.ceil(unpaddedLength / 8) * 8;
    const padding = Buffer.alloc(paddedLength - unpaddedLength + 1);
    return Buffer.concat([fixedFields, filePathBytes, padding]);
  });

  return Buffer.concat([header, ...entries, Buffer.alloc(20)]);
}

async function main() {
  const visualSmokeScript = await readScript('agent-browser/scripts/visual-smoke.mjs');
  assert.match(visualSmokeScript, /waitUntil:\s*'domcontentloaded'/);
  assert.match(visualSmokeScript, /navigationTimeoutMs\s*=\s*900_000/);
  assert.match(visualSmokeScript, /shellTimeoutMs\s*=\s*30_000/);
  assert.match(visualSmokeScript, /\*\*\/api\/cursor\/status/);
  assert.match(visualSmokeScript, /Symphony task management system/);
  assert.match(visualSmokeScript, /Review Gate/);
  assert.match(visualSmokeScript, /Agent Workspaces/);
  assert.match(visualSmokeScript, /No active Symphony task/);
  assert.match(visualSmokeScript, /Start Symphony task/);
  assert.match(visualSmokeScript, /agent-browser-symphony-system\.png/);
  assert.match(visualSmokeScript, /Infinite session canvas/);
  assert.match(visualSmokeScript, /Session summary widget/);
  assert.match(visualSmokeScript, /Knowledge widget/);
  assert.match(visualSmokeScript, /captureDashboardCanvasViewportMatrix/);
  assert.match(visualSmokeScript, /agent-browser-dashboard-canvas-mobile\.png/);
  assert.match(visualSmokeScript, /agent-browser-dashboard-canvas-tablet\.png/);
  assert.match(visualSmokeScript, /agent-browser-dashboard-canvas-wide\.png/);
  assert.match(visualSmokeScript, /Workspace wiki/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki\.png/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki-pages\.png/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki-pages-mobile\.png/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki-graph\.png/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki-mobile\.png/);
  assert.match(visualSmokeScript, /wiki:ws-research:workspace-map/);
  assert.match(visualSmokeScript, /Adversary tool review/);
  assert.match(visualSmokeScript, /Enable adversary tool-call review/);
  assert.match(visualSmokeScript, /Partner agent control plane/);
  assert.match(visualSmokeScript, /Enable partner-agent control plane/);
  assert.match(visualSmokeScript, /Workspace skill policies/);
  assert.match(visualSmokeScript, /Least-privilege enforcement/);
  assert.match(visualSmokeScript, /Policy-aware regex grep/);
  assert.match(visualSmokeScript, /Runtime plugins/);
  assert.match(visualSmokeScript, /Enable runtime plugins/);
  assert.match(visualSmokeScript, /Tool-call interception mode/);
  assert.match(visualSmokeScript, /Evaluation-native observability/);
  assert.match(visualSmokeScript, /Live experiment/);
  assert.match(visualSmokeScript, /Workflow canvas workbench/);
  assert.match(visualSmokeScript, /workflow-canvas-plugin-renderer/);
  assert.match(visualSmokeScript, /Generate campaign media/);
  assert.match(visualSmokeScript, /agent-browser-workflow-canvas\.png/);
  assert.match(visualSmokeScript, /Scheduled automations/);
  assert.match(visualSmokeScript, /Enable Daily workspace audit/);
  assert.match(visualSmokeScript, /Chaptered sessions/);
  assert.match(visualSmokeScript, /Enable chaptered sessions/);
  assert.match(visualSmokeScript, /Enable browser notifications/);
  assert.match(visualSmokeScript, /git init/);
  assert.match(visualSmokeScript, /git status --short/);
  assert.match(visualSmokeScript, /2026-05-09-git-stub-terminal-visual-smoke\.png/);
  assert.match(visualSmokeScript, /Typed run SDK/);
  assert.match(visualSmokeScript, /Structured event stream/);
  assert.match(visualSmokeScript, /Reconnect cursor/);
  assert.match(visualSmokeScript, /agent-browser-typed-run-sdk\.png/);
  assert.doesNotMatch(visualSmokeScript, /waitUntil:\s*'networkidle'/);

  const packageJson = await readScript('package.json');
  const rootPackage = JSON.parse(packageJson);
  const rootReadme = await readScript('README.md');
  const extReadme = await readScript('ext/README.md');
  const workerReadme = await readScript('lib/worker/README.md');
  const durableTasksReadme = await readScript('lib/browser-durable-tasks/README.md');
  assert.match(rootReadme, /## Workspace packages/);
  assert.match(rootReadme, /\|\s*Workspace\s*\|\s*Import path\s*\|\s*Purpose\s*\|/);
  assert.match(rootReadme, /\[`agent-browser\/README\.md`\]\(\.\/agent-browser\/README\.md\)/);
  assert.match(rootReadme, /## Other maintained surfaces/);
  assert.match(rootReadme, /\[`competition\/README\.md`\]\(\.\/competition\/README\.md\)/);
  assert.match(rootReadme, /\[`dev-evals\/agent-chat\/README\.md`\]\(\.\/dev-evals\/agent-chat\/README\.md\)/);
  assert.match(rootReadme, /\[`plugins\/deep-research-harness-ide\/README\.md`\]\(\.\/plugins\/deep-research-harness-ide\/README\.md\)/);
  assert.match(rootReadme, /\[`research\/README\.md`\]\(\.\/research\/README\.md\)/);
  assert.match(rootReadme, /\[`docs\/plugin-standards\.md`\]\(\.\/docs\/plugin-standards\.md\)/);
  assert.match(rootReadme, /installable extension packages for IDE, harness, provider, and worker features/);
  assert.match(
    rootReadme,
    /\[`ext\/README\.md`\]\(\.\/ext\/README\.md\) \| `ext\/\*\/\*` \| Workspace index for the public IDE, harness, provider, and worker extension packages\./,
  );
  assert.match(extReadme, /## Worker extensions/);
  assert.match(
    extReadme,
    /\[`ext\/worker\/local-inference-worker\/README\.md`\]\(\.\/worker\/local-inference-worker\/README\.md\) `local-inference-worker`/,
  );
  const publicExtensionDocs = await discoverPublicExtensionDocs(repoRoot);
  for (const extensionDoc of publicExtensionDocs) {
    assert.match(
      extReadme,
      new RegExp(
        String.raw`\[\`${escapeRegExp(extensionDoc.readmePath)}\`\]\(\.\/${escapeRegExp(extensionDoc.readmePath.replace(/^ext\//, ''))}\)\s+\`${escapeRegExp(extensionDoc.packageName)}\``,
      ),
    );
  }
  assert.doesNotMatch(extReadme, /ext\/ide\/workflow-canvas-tests\/README\.md/);
  for (const packageDirectory of [
    'agent-browser-mcp',
    'agent-sandbox',
    'browser-durable-tasks',
    'claimify',
    'core-tool-api',
    'cost-aware-routing',
    'git-stub',
    'harness-task-manager',
    'inbrowser-use',
    'lean-browser',
    'llguidance-wasm',
    'logact',
    'logact-loop',
    'ralph-loop',
    'recursive-research-agent',
    'webmcp',
    'worker',
    'workgraph',
  ]) {
    assert.match(rootReadme, new RegExp(escapeRegExp(`lib/${packageDirectory}/README.md`)));
    assert.match(rootReadme, new RegExp(escapeRegExp(`(./lib/${packageDirectory}/README.md)`)));
  }
  assert.match(workerReadme, /## Core building blocks/);
  assert.match(workerReadme, /## Minimal worker and sandbox flow/);
  assert.match(workerReadme, /## Capability and policy contracts/);
  assert.match(workerReadme, /## Provider descriptors and artifacts/);
  assert.match(workerReadme, /`createSandbox\(\)` returns a `SandboxLease`/);
  assert.match(workerReadme, /DefaultPolicyEngine` is deny-by-default/);
  assert.match(workerReadme, /npm --workspace @agent-harness\/worker run test:coverage/);
  assert.match(durableTasksReadme, /## Core building blocks/);
  assert.match(durableTasksReadme, /## Minimal runtime flow/);
  assert.match(durableTasksReadme, /## Runtime and persistence semantics/);
  assert.match(durableTasksReadme, /## Outbox and background sync/);
  assert.match(durableTasksReadme, /## Failure modes and limits/);
  assert.match(durableTasksReadme, /createDurableTaskRuntime/);
  assert.match(durableTasksReadme, /createMemoryDurableTaskStore/);
  assert.match(durableTasksReadme, /createServiceWorkerOutboxBridge/);
  assert.match(durableTasksReadme, /resumeExpiredLocks\(\)/);
  assert.match(durableTasksReadme, /npm\.cmd --workspace @agent-harness\/browser-durable-tasks run test:coverage/);
  assert.ok(rootPackage.workspaces.includes('ext/*/*'));
  assert.equal(rootPackage.scripts['lint:extensions'], 'node scripts/run-extension-workspaces.mjs lint');
  assert.equal(rootPackage.scripts['build:extensions'], 'node scripts/run-extension-workspaces.mjs build');
  assert.equal(rootPackage.scripts['build:extension-downloads'], 'node scripts/package-extension-downloads.mjs');
  assert.equal(rootPackage.scripts['test:extensions'], 'node scripts/run-extension-workspaces.mjs test');
  assert.equal(rootPackage.scripts['test:coverage:extensions'], 'node scripts/run-extension-workspaces.mjs test:coverage');
  assert.match(packageJson, /"verify:agent-browser": "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\/verify-agent-browser\.ps1"/);
  assert.match(packageJson, /"check:generated-files": "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\/check-generated-files-clean\.ps1"/);
  const verifyAgentBrowserScript = await readScript('scripts/verify-agent-browser.ps1');
  assert.match(verifyAgentBrowserScript, /chat-loop-evals/);
  assert.doesNotMatch(verifyAgentBrowserScript, /validate-evals/);
  assert.doesNotMatch(verifyAgentBrowserScript, /test-evals/);
  for (const extensionPackagePath of [
    'ext/harness/agent-skills/package.json',
    'ext/harness/agents-md/package.json',
    'ext/ide/design-md/package.json',
  ]) {
    const extensionPackage = JSON.parse(await readScript(extensionPackagePath));
    assert.equal(extensionPackage.scripts.lint, 'tsc -p tsconfig.json --noEmit');
    assert.equal(extensionPackage.scripts.build, 'tsc -p tsconfig.json --noEmit');
    assert.match(extensionPackage.scripts.test, /vitest run/);
    assert.match(extensionPackage.scripts['test:coverage'], /vitest run --coverage/);
  }
  const generatedFilesWrapper = await readScript('scripts/check-generated-files-clean.ps1');
  assert.match(generatedFilesWrapper, /codex-git\.ps1'\) ls-files/);
  assert.match(generatedFilesWrapper, /check-generated-files-clean\.mjs'\) --stdin-lines/);
  const linearCanceledIssueScript = await readScript('scripts/linear-list-canceled-active-issues.mjs');
  assert.match(linearCanceledIssueScript, /LINEAR_API_KEY/);
  assert.match(linearCanceledIssueScript, /--from-json/);
  assert.match(linearCanceledIssueScript, /state-type/);
  const linearCanceledIssueWrapper = await readScript('scripts/list-linear-canceled-issues.mjs');
  assert.match(linearCanceledIssueWrapper, /linear-list-canceled-active-issues\.mjs/);
  const previewExtensionInstaller = await readScript('scripts/install-agent-browser-preview-extension.sh');
  assert.match(previewExtensionInstaller, /rm -rf "\$tmp_dir\/extension\/tests"/);
  const daemonBuildWorkflow = await readScript('.github/workflows/daemon-build.yml');
  assert.match(daemonBuildWorkflow, /denoland\/setup-deno@v2/);
  assert.match(daemonBuildWorkflow, /--target x86_64-pc-windows-msvc/);
  assert.doesNotMatch(daemonBuildWorkflow, /aarch64-pc-windows-msvc/);
  assert.match(daemonBuildWorkflow, /agent-harness-local-inference-daemon-windows-x64\.exe/);
  assert.doesNotMatch(daemonBuildWorkflow, /agent-harness-local-inference-daemon-windows-arm64\.exe/);
  assert.doesNotMatch(daemonBuildWorkflow, /cache: npm/);
  assert.match(daemonBuildWorkflow, /npm install --package-lock=false/);
  assert.match(daemonBuildWorkflow, /actions\/upload-artifact@v4/);
  const agentBrowserPackageJson = await readScript('agent-browser/package.json');
  assert.match(agentBrowserPackageJson, /"test:coverage": "node scripts\/run-vitest-coverage\.mjs"/);
  assert.match(agentBrowserPackageJson, /"test:eval-workflows": "node \.\.\/scripts\/run-package-bin\.mjs vitest run --config vitest\.evals\.config\.ts"/);
  assert.doesNotMatch(agentBrowserPackageJson, /"eval:hf-lighteval-chat"/);
  assert.match(agentBrowserPackageJson, /"smoke:git-stub": "node scripts\/git-stub-smoke\.mjs"/);
  assert.match(agentBrowserPackageJson, /"smoke:context-manager": "node scripts\/context-manager-smoke\.mjs"/);
  assert.match(agentBrowserPackageJson, /"smoke:deployed-web-search": "node scripts\/deployed-web-search-smoke\.mjs"/);
  assert.match(agentBrowserPackageJson, /"@agent-harness\/git-stub": "0\.1\.0"/);
  assert.match(agentBrowserPackageJson, /"@agent-harness\/prompt-budget": "0\.1\.0"/);
  const deployedWebSearchSmokeScript = await readScript('agent-browser/scripts/deployed-web-search-smoke.mjs');
  assert.match(deployedWebSearchSmokeScript, /AGENT_BROWSER_BASE_URL/);
  assert.match(deployedWebSearchSmokeScript, /\/api\/web-search/);
  assert.match(deployedWebSearchSmokeScript, /\/api\/web-page/);
  assert.match(deployedWebSearchSmokeScript, /_vercel_share/);
  assert.match(deployedWebSearchSmokeScript, /set-cookie/);
  assert.match(deployedWebSearchSmokeScript, /vercel curl/);
  assert.match(deployedWebSearchSmokeScript, /--data-binary/);
  assert.match(deployedWebSearchSmokeScript, /AGENT_BROWSER_VERCEL_SCOPE/);
  assert.match(deployedWebSearchSmokeScript, /content-type/);
  assert.match(deployedWebSearchSmokeScript, /response\.status === 404 \|\| response\.status >= 500/);
  const runtimeSearchProofScript = await readScript('agent-browser/scripts/runtime-search-proof.mjs');
  assert.match(runtimeSearchProofScript, /--provider/);
  assert.match(runtimeSearchProofScript, /onnx-community\/Qwen3-0\.6B-ONNX/);
  assert.match(runtimeSearchProofScript, /selected-provider-by-session/);
  assert.match(runtimeSearchProofScript, /ghcpChatCalls/);
  assert.match(runtimeSearchProofScript, /Web search returned 404/);
  assert.match(runtimeSearchProofScript, /Please provide a search source/);
  const contextManagerSmokeScript = await readScript('agent-browser/scripts/context-manager-smoke.mjs');
  assert.match(contextManagerSmokeScript, /vite\.config\.ts/);
  assert.match(contextManagerSmokeScript, /'--config'/);
  const gitStubPackageJson = JSON.parse(await readScript('lib/git-stub/package.json'));
  assert.equal(gitStubPackageJson.name, '@agent-harness/git-stub');
  assert.equal(gitStubPackageJson.scripts.test, 'node ../../scripts/run-package-bin.mjs vitest run');
  const previewExtensionPackageJson = JSON.parse(
    await readScript('tools/agent-browser-preview-extension/extension/package.json'),
  );
  assert.equal(previewExtensionPackageJson.scripts.test, 'node --test tests/*.test.js');
  assert.deepEqual(previewExtensionPackageJson.files, [
    'main.js',
    'logic.js',
  ]);
  const localModelConnectorExtensionTsconfig = JSON.parse(
    await readScript('ext/provider/local-model-connector/tsconfig.extension.json'),
  );
  assert.equal(localModelConnectorExtensionTsconfig.compilerOptions.sourceMap, false);
  const vercelConfig = JSON.parse(await readScript('vercel.json'));
  assert.equal(vercelConfig.installCommand, 'node scripts/vercel-install.mjs');
  assert.equal(vercelConfig.buildCommand, 'cd agent-browser && npm run build');
  assert.equal(vercelConfig.outputDirectory, 'agent-browser/dist');
  const vercelIgnore = await readScript('.vercelignore');
  for (const requiredPattern of [
    '.env*',
    '!.env.example',
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    'node_modules/',
    '**/node_modules/',
    '.npm-cache/',
    'coverage/',
    '**/coverage/',
    'playwright-report/',
    'test-results/',
    'output/',
    '.agentv/cache.json',
    '.codex/environments/',
    '*.log',
    '*.tsbuildinfo',
    '*.tmp',
    '*.bak',
    '*~',
    'package-lock.json',
  ]) {
    assert.match(vercelIgnore, new RegExp(`^${requiredPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }

  const dockerIgnore = await readScript('.dockerignore');
  for (const requiredPattern of [
    '.env*',
    '!.env.example',
    '.git/',
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    'node_modules/',
    '**/node_modules/',
    '.npm-cache/',
    'coverage/',
    '**/coverage/',
    'playwright-report/',
    'test-results/',
    'output/',
    '.agentv/cache.json',
    '.codex/environments/',
    '*.log',
    '*.tsbuildinfo',
    '*.tmp',
    '*.bak',
    '*~',
    'package-lock.json',
  ]) {
    assert.match(dockerIgnore, new RegExp(`^${requiredPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  const gitIgnore = await readScript('.gitignore');
  for (const requiredPattern of [
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    '*.tmp',
    '*.bak',
    '*~',
  ]) {
    assert.match(gitIgnore, new RegExp(`^${requiredPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }

  const vercelInstall = await import(pathToFileURL(path.resolve(repoRoot, 'scripts/vercel-install.mjs')).href);
  assert.equal(vercelInstall.getNpmExecutable('win32'), 'npm.cmd');
  assert.equal(vercelInstall.getNpmExecutable('linux'), 'npm');
  assert.equal(vercelInstall.usesShellForPlatform('win32'), true);
  assert.equal(vercelInstall.usesShellForPlatform('linux'), false);
  assert.equal(
    vercelInstall.buildInstallEnvironment({ ONNXRUNTIME_NODE_INSTALL: 'force' }).ONNXRUNTIME_NODE_INSTALL,
    'force',
  );
  assert.equal(vercelInstall.buildInstallEnvironment({}).ONNXRUNTIME_NODE_INSTALL, 'skip');
  assert.deepEqual(vercelInstall.buildInstallSteps('npm'), [
    ['npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--loglevel=error']],
    ['npm', ['ci', '--no-audit', '--loglevel=error']],
    ['npm', ['audit', '--audit-level=moderate']],
  ]);
  const lockfileFixture = await mkdtemp(path.join(tmpdir(), 'vercel-install-lockfile-'));
  const rootLockfile = path.join(lockfileFixture, 'package-lock.json');
  const workspaceLockfile = path.join(lockfileFixture, 'agent-browser', 'package-lock.json');
  const rootNodeModules = path.join(lockfileFixture, 'node_modules');
  const workspaceNodeModules = path.join(lockfileFixture, 'agent-browser', 'node_modules');
  await mkdir(path.join(lockfileFixture, 'agent-browser'), { recursive: true });
  await mkdir(rootNodeModules, { recursive: true });
  await mkdir(workspaceNodeModules, { recursive: true });
  await writeFile(rootLockfile, '{}');
  await writeFile(workspaceLockfile, '{}');
  assert.deepEqual(
    await vercelInstall.resolveInstallWorkItems(lockfileFixture),
    [
      {
        workingDirectory: lockfileFixture,
        lockfilePath: rootLockfile,
        nodeModulesPath: rootNodeModules,
      },
      {
        workingDirectory: path.join(lockfileFixture, 'agent-browser'),
        lockfilePath: workspaceLockfile,
        nodeModulesPath: workspaceNodeModules,
      },
    ],
  );

  const patchFixture = await mkdtemp(path.join(tmpdir(), 'workspace-patches-'));
  await mkdir(path.join(patchFixture, 'patches'), { recursive: true });
  await mkdir(path.join(patchFixture, 'node_modules', '@tavily', 'core'), { recursive: true });
  await writeJson(path.join(patchFixture, 'package.json'), {
    name: 'patch-fixture',
    private: true,
    dependencies: { '@tavily/core': '0.7.3' },
  });
  await writeFile(path.join(patchFixture, 'patches', '@tavily+core+0.7.3.patch'), 'diff --git a/file b/file\n');
  const patchInstaller = await import(pathToFileURL(path.resolve(repoRoot, 'scripts/apply-workspace-patches.mjs')).href);
  assert.equal(
    patchInstaller.findInstalledPackageDirectory(
      '@tavily/core',
      path.join(patchFixture, 'node_modules', '@tavily', 'core'),
    ),
    path.join(patchFixture, 'node_modules', '@tavily', 'core'),
  );

  const extensionFixture = await mkdtemp(path.join(tmpdir(), 'extension-workspaces-'));
  await mkdir(path.join(extensionFixture, 'ext', 'ide', 'alpha'), { recursive: true });
  await mkdir(path.join(extensionFixture, 'ext', 'ide', 'not-a-package'), { recursive: true });
  await mkdir(path.join(extensionFixture, 'ext', 'runtime', 'beta'), { recursive: true });
  await writeJson(path.join(extensionFixture, 'ext', 'ide', 'alpha', 'package.json'), {
    name: '@agent-harness/ext-alpha',
    scripts: { test: 'vitest run' },
  });
  await mkdir(path.join(extensionFixture, 'ext', 'ide', 'not-a-package', 'node_modules', 'generated-package'), { recursive: true });
  await writeJson(path.join(extensionFixture, 'ext', 'ide', 'not-a-package', 'node_modules', 'package.json'), {
    name: '@agent-harness/generated-node-modules',
    scripts: { test: 'vitest run' },
  });
  await writeJson(path.join(extensionFixture, 'ext', 'ide', 'not-a-package', 'node_modules', 'generated-package', 'package.json'), {
    name: '@agent-harness/generated-package',
    scripts: { test: 'vitest run' },
  });
  await writeJson(path.join(extensionFixture, 'ext', 'runtime', 'beta', 'package.json'), {
    name: '@agent-harness/ext-beta',
    scripts: { test: 'vitest run' },
  });
  assert.deepEqual(await extensionRunner.discoverExtensionWorkspaces(extensionFixture), [
    { name: '@agent-harness/ext-alpha', directory: path.join(extensionFixture, 'ext', 'ide', 'alpha') },
    { name: '@agent-harness/ext-beta', directory: path.join(extensionFixture, 'ext', 'runtime', 'beta') },
  ]);
  assert.deepEqual(extensionRunner.buildWorkspaceScriptArgs('@agent-harness/ext-alpha', 'test:coverage'), [
    '--workspace',
    '@agent-harness/ext-alpha',
    'run',
    'test:coverage',
  ]);
  assert.throws(() => extensionRunner.normalizeRequestedScripts([]), /At least one extension script/);
  assert.deepEqual(extensionRunner.normalizeRequestedScripts(['lint', 'test:coverage']), ['lint', 'test:coverage']);
  const coverageRunner = await import(pathToFileURL(path.resolve(repoRoot, 'agent-browser/scripts/run-vitest-coverage.mjs')).href);
  const coverageRunnerScript = await readScript('agent-browser/scripts/run-vitest-coverage.mjs');
  assert.match(coverageRunnerScript, /DEFAULT_COVERAGE_BATCH_CONCURRENCY = 4/);
  assert.match(coverageRunnerScript, /DEFAULT_WINDOWS_COVERAGE_BATCH_CONCURRENCY = 1/);
  assert.match(coverageRunnerScript, /DEFAULT_WINDOWS_COVERAGE_BATCH_SIZE = 12/);
  assert.match(coverageRunnerScript, /resolveCoverageBatchConcurrency/);
  assert.match(coverageRunnerScript, /resolveCoverageBatchSize/);
  assert.match(coverageRunnerScript, /runVitestCommandsConcurrently/);
  assert.match(coverageRunnerScript, /runVitestCommandWithRetry/);
  assert.match(coverageRunnerScript, /retrying once/);
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({ AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: '1' }),
    1,
  );
  const previousCoverageBatchConcurrency = process.env.AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY;
  process.env.AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY = '2';
  try {
    assert.equal(coverageRunner.resolveCoverageBatchConcurrency(), 2);
  } finally {
    if (previousCoverageBatchConcurrency === undefined) {
      delete process.env.AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY;
    } else {
      process.env.AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY = previousCoverageBatchConcurrency;
    }
  }
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({ AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: ' 3 ' }),
    3,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({
      platform: 'linux',
      env: { AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: '0' },
    }),
    4,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({
      platform: 'linux',
      env: { AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: 'nope' },
    }),
    4,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({ platform: 'win32', env: {} }),
    1,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({ platform: 'linux', env: {} }),
    4,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({
      platform: 'win32',
      env: { AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: '2' },
    }),
    2,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchConcurrency({
      platform: 'win32',
      env: { AGENT_BROWSER_COVERAGE_BATCH_CONCURRENCY: '0' },
    }),
    1,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({ AGENT_BROWSER_COVERAGE_BATCH_SIZE: '6' }),
    6,
  );
  const previousCoverageBatchSize = process.env.AGENT_BROWSER_COVERAGE_BATCH_SIZE;
  process.env.AGENT_BROWSER_COVERAGE_BATCH_SIZE = '12';
  try {
    assert.equal(coverageRunner.resolveCoverageBatchSize(), 12);
  } finally {
    if (previousCoverageBatchSize === undefined) {
      delete process.env.AGENT_BROWSER_COVERAGE_BATCH_SIZE;
    } else {
      process.env.AGENT_BROWSER_COVERAGE_BATCH_SIZE = previousCoverageBatchSize;
    }
  }
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({ AGENT_BROWSER_COVERAGE_BATCH_SIZE: ' 8 ' }),
    8,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({
      platform: 'linux',
      env: { AGENT_BROWSER_COVERAGE_BATCH_SIZE: '0' },
    }),
    25,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({
      platform: 'win32',
      env: { AGENT_BROWSER_COVERAGE_BATCH_SIZE: '0' },
    }),
    12,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({ platform: 'win32', env: {} }),
    12,
  );
  assert.equal(
    coverageRunner.resolveCoverageBatchSize({ platform: 'linux', env: {} }),
    25,
  );
  assert.deepEqual(
    coverageRunner.buildVitestCoverageArgs(['--reporter=dot'], '../output/coverage/agent-browser-test'),
    [
      'run',
      '--coverage',
      '--coverage.processingConcurrency=1',
      '--coverage.reporter=text-summary',
      '--coverage.reportsDirectory=../output/coverage/agent-browser-test',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--pool=forks',
      '--teardownTimeout=60000',
      '--exclude',
      'src/App.integration.test.tsx',
      '--exclude',
      'src/App.smoke.test.tsx',
      '--reporter=dot',
    ],
  );
  assert.deepEqual(
    coverageRunner.buildVitestCoverageArgs([], '../output/coverage/agent-browser-test', ['src/services/workspaceFiles.test.ts']),
    [
      'run',
      '--coverage',
      '--coverage.processingConcurrency=1',
      '--coverage.reporter=text-summary',
      '--coverage.reportsDirectory=../output/coverage/agent-browser-test',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--pool=forks',
      '--teardownTimeout=60000',
      '--exclude',
      'src/App.integration.test.tsx',
      '--exclude',
      'src/App.smoke.test.tsx',
      '--reporter=dot',
      'src/services/workspaceFiles.test.ts',
    ],
  );
  assert.deepEqual(
    coverageRunner.buildVitestCoverageArgs([], null, ['src/services/workspaceFiles.test.ts']),
    [
      'run',
      '--coverage',
      '--coverage.processingConcurrency=1',
      '--coverage.reporter=text-summary',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--pool=forks',
      '--teardownTimeout=60000',
      '--exclude',
      'src/App.integration.test.tsx',
      '--exclude',
      'src/App.smoke.test.tsx',
      '--reporter=dot',
      'src/services/workspaceFiles.test.ts',
    ],
  );
  assert.deepEqual(
    coverageRunner.chunkTestFiles(['a.test.ts', 'b.test.ts', 'c.test.ts'], 2),
    [['a.test.ts', 'b.test.ts'], ['c.test.ts']],
  );
  assert.throws(() => coverageRunner.chunkTestFiles(['a.test.ts'], 0), /positive integer/);
  assert.deepEqual(
    coverageRunner.buildAppTestArgs(),
    [
      'run',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--pool=forks',
      '--teardownTimeout=60000',
      '--reporter=dot',
      'src/App.integration.test.tsx',
      'src/App.smoke.test.tsx',
    ],
  );
  assert.deepEqual(
    coverageRunner.chunkTestFiles(['a.test.ts', 'b.test.ts', 'c.test.ts'], 2),
    [
      ['a.test.ts', 'b.test.ts'],
      ['c.test.ts'],
    ],
  );
  assert.deepEqual(
    coverageRunner.chunkTestFiles(['a.test.ts', 'b.test.ts', 'c.test.ts', 'd.test.ts'], 3),
    [['a.test.ts', 'b.test.ts', 'c.test.ts'], ['d.test.ts']],
  );
  const coverageFileFixture = await mkdtemp(path.join(tmpdir(), 'agent-browser-coverage-files-'));
  await mkdir(path.join(coverageFileFixture, 'evals', 'search'), { recursive: true });
  await mkdir(path.join(coverageFileFixture, 'src', 'services'), { recursive: true });
  await writeFile(path.join(coverageFileFixture, 'evals', 'search', 'agentvWorkflowGate.test.ts'), '');
  await writeFile(path.join(coverageFileFixture, 'src', 'App.integration.test.tsx'), '');
  await writeFile(path.join(coverageFileFixture, 'src', 'App.smoke.test.tsx'), '');
  await writeFile(path.join(coverageFileFixture, 'src', 'services', 'cursorApi.test.ts'), '');
  assert.deepEqual(
    await coverageRunner.discoverCoverageTestFiles(coverageFileFixture),
    ['src/services/cursorApi.test.ts'],
  );
  assert.equal(coverageRunner.isVitestCoverageTmpCleanupRace({
    exitCode: 1,
    output: [
      ' Test Files  93 passed (93)',
      '      Tests  965 passed (965)',
      '=============================== Coverage summary ===============================',
      "Error: ENOENT: no such file or directory, lstat 'C:\\src\\agent-harness\\output\\coverage\\agent-browser-123\\.tmp'",
    ].join('\n'),
  }), true);
  assert.equal(coverageRunner.isVitestCoverageTmpCleanupRace({
    exitCode: 1,
    output: [
      ' Test Files  92 passed | 1 failed (93)',
      '      Tests  964 passed | 1 failed (965)',
      "Error: ENOENT: no such file or directory, lstat 'C:\\src\\agent-harness\\output\\coverage\\agent-browser-123\\.tmp'",
    ].join('\n'),
  }), false);
  assert.equal(coverageRunner.isVitestCoverageTmpCleanupRace({
    exitCode: 4294967295,
    output: [
      ' Test Files  12 passed (12)',
      '      Tests  98 passed (98)',
      '% Coverage report from v8',
      '-------------------|---------|----------|---------|---------|-------------------',
    ].join('\n'),
  }), true);
  assert.equal(coverageRunner.isVitestCoverageTmpCleanupRace({
    exitCode: 4294967295,
    output: [
      ' Test Files  11 passed | 1 failed (12)',
      '      Tests  97 passed | 1 failed (98)',
      '% Coverage report from v8',
    ].join('\n'),
  }), false);

  const verifyScript = await readScript('scripts/verify-agent-browser.ps1');
  const sourceHygieneIndex = verifyScript.indexOf("Label = 'source-hygiene'");
  const testScriptsIndex = verifyScript.indexOf("Label = 'test-scripts'");
  const chatLoopEvalsIndex = verifyScript.indexOf("Label = 'chat-loop-evals'");
  const extensionLintIndex = verifyScript.indexOf("Label = 'extension-lint'");
  const extensionCoverageIndex = verifyScript.indexOf("Label = 'extension-coverage'");
  const extensionBuildIndex = verifyScript.indexOf("Label = 'extension-build'");
  const promptBudgetCoverageIndex = verifyScript.indexOf("Label = 'prompt-budget-coverage'");
  const searchAnsweringCoverageIndex = verifyScript.indexOf("Label = 'search-answering-coverage'");
  const lintIndex = verifyScript.indexOf("Label = 'lint'");
  const buildIndex = verifyScript.indexOf("Label = 'build'");
  assert.notEqual(sourceHygieneIndex, -1);
  assert.notEqual(testScriptsIndex, -1);
  assert.notEqual(chatLoopEvalsIndex, -1);
  assert.notEqual(extensionLintIndex, -1);
  assert.notEqual(extensionCoverageIndex, -1);
  assert.notEqual(extensionBuildIndex, -1);
  assert.notEqual(promptBudgetCoverageIndex, -1);
  assert.notEqual(searchAnsweringCoverageIndex, -1);
  assert.notEqual(lintIndex, -1);
  assert.notEqual(buildIndex, -1);
  assert.ok(sourceHygieneIndex < testScriptsIndex);
  assert.ok(testScriptsIndex < chatLoopEvalsIndex);
  assert.ok(chatLoopEvalsIndex < extensionLintIndex);
  assert.ok(extensionLintIndex < extensionCoverageIndex);
  assert.ok(extensionCoverageIndex < extensionBuildIndex);
  assert.ok(extensionBuildIndex < promptBudgetCoverageIndex);
  assert.ok(promptBudgetCoverageIndex < searchAnsweringCoverageIndex);
  assert.ok(searchAnsweringCoverageIndex < lintIndex);
  assert.match(verifyScript, /@agent-harness\/prompt-budget/);
  assert.match(verifyScript, /@agent-harness\/search-answering/);
  assert.ok(lintIndex < buildIndex);
  assert.match(verifyScript, /npm warn/i);
  assert.match(verifyScript, /vite:reporter/i);
  assert.match(verifyScript, /warn exec The following package was not found/i);
  assert.match(verifyScript, /\[System\.IO\.Path\]::GetTempFileName\(\)/);
  assert.match(verifyScript, /Tee-Object -FilePath \$outputFile/);
  assert.match(verifyScript, /Get-Content -LiteralPath \$outputFile -Raw/);
  assert.match(verifyScript, /\$maxAttempts = 2/);
  assert.match(verifyScript, /retrying once/);
  assert.match(verifyScript, /verify:agent-browser starting/);

  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'search-eval-target-bin-'));
  await writeJson(path.join(fixtureRoot, 'package.json'), { name: 'fixture-app', private: true });
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));

  await createPackageFixture(fixtureRoot, 'string-bin-package', { bin: './cli.js' });
  assert.equal(
    await resolvePackageBin('string-bin-package', fixtureRequire),
    path.join(fixtureRoot, 'node_modules', 'string-bin-package', 'cli.js'),
  );

  await createPackageFixture(fixtureRoot, '@scope/object-bin-package', {
    bin: {
      '@scope/object-bin-package': './scoped-cli.js',
    },
  });
  assert.equal(
    await resolvePackageBin('@scope/object-bin-package', fixtureRequire),
    path.join(fixtureRoot, 'node_modules', '@scope', 'object-bin-package', 'scoped-cli.js'),
  );

  await createPackageFixture(fixtureRoot, 'missing-bin-package', {});
  await assert.rejects(
    () => resolvePackageBin('missing-bin-package', fixtureRequire),
    /does not declare a runnable bin entry/,
  );
  await assert.rejects(
    () => resolvePackageBin('', fixtureRequire),
    /requires a non-empty package name/,
  );

  const trackedArtifacts = findTrackedGeneratedArtifacts([
    '.agentv/targets.yaml',
    'agent-browser/evals/search-fulfillment/EVAL.yaml',
    'skills/agent-harness-context/evals/evals.json',
    'package-lock.json',
    'agent-browser/package-lock.json',
    'coverage/lcov.info',
    'lib/webmcp/coverage/coverage-final.json',
    'playwright-report/index.html',
    'test-results/.last-run.json',
    'agent-browser/tsconfig.tsbuildinfo',
    'agent-browser-debug.log',
    'notes.tmp',
    'README.md~',
    'Thumbs.db',
    '.DS_Store',
    'output/evals/search-fulfillment-agentv/timing.json',
    'output/dev-server/agent-browser-5174.out.log',
    '.patches-JtbPSD/guidance-ts+1.0.0.patch',
    '.npm-cache/_logs/2026-05-02T00_00_00_000Z-debug-0.log',
    '_cacache/index-v5/00/00/cache-entry',
    '_logs/2026-05-02T00_00_00_000Z-debug-0.log',
    '_update-notifier-last-checked',
    '.agentv/cache.json',
    '.codex/environments/environment.toml',
    '.codex-tk26-objects/0e/6a0096338608df4fcd3f7d80dc0dcc8710d298',
    '.codex-tk26-index-main/index.json',
    'ext/provider/local-model-connector/dist/background.js.map',
    'ext/provider/local-model-connector/dist/background.js',
    'ext/provider/local-model-connector/dist/local-model-connector-extension.zip',
  ]);
  assert.deepEqual(
    trackedArtifacts.map((artifact) => artifact.path),
    [
      'package-lock.json',
      'agent-browser/package-lock.json',
      'coverage/lcov.info',
      'lib/webmcp/coverage/coverage-final.json',
      'playwright-report/index.html',
      'test-results/.last-run.json',
      'agent-browser/tsconfig.tsbuildinfo',
      'agent-browser-debug.log',
      'notes.tmp',
      'README.md~',
      'Thumbs.db',
      '.DS_Store',
      'output/evals/search-fulfillment-agentv/timing.json',
      'output/dev-server/agent-browser-5174.out.log',
      '.patches-JtbPSD/guidance-ts+1.0.0.patch',
      '.npm-cache/_logs/2026-05-02T00_00_00_000Z-debug-0.log',
      '_cacache/index-v5/00/00/cache-entry',
      '_logs/2026-05-02T00_00_00_000Z-debug-0.log',
      '_update-notifier-last-checked',
      '.agentv/cache.json',
      '.codex/environments/environment.toml',
      '.codex-tk26-objects/0e/6a0096338608df4fcd3f7d80dc0dcc8710d298',
      '.codex-tk26-index-main/index.json',
      'ext/provider/local-model-connector/dist/background.js.map',
    ],
  );
  assert.match(
    formatTrackedGeneratedArtifactsError(trackedArtifacts),
    /Generated or local-only artifacts are tracked by git/,
  );
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /output\/evals/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.patches-JtbPSD\/guidance-ts\+1\.0\.0\.patch/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/package-lock\.json/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /coverage\/lcov\.info/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /playwright-report\/index\.html/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /test-results\/\.last-run\.json/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/tsconfig\.tsbuildinfo/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser-debug\.log/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /notes\.tmp/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /README\.md~/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /Thumbs\.db/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.DS_Store/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.npm-cache\/_logs/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /_cacache\//);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.agentv\/cache\.json/);
  assert.match(
    formatTrackedGeneratedArtifactsError(trackedArtifacts),
    /ext\/provider\/local-model-connector\/dist\/background\.js\.map/,
  );
  assert.deepEqual(
    buildGitLsFilesInvocation(repoRoot, 'win32'),
    {
      command: 'powershell',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(repoRoot, 'scripts', 'codex-git.ps1'),
        'ls-files',
        '-z',
      ],
    },
  );
  assert.deepEqual(
    buildGitLsFilesInvocation(repoRoot, 'linux'),
    {
      command: 'git',
      args: ['ls-files', '-z'],
    },
  );
  assert.deepEqual(
    readTrackedFilesFromLineInput("src/index.ts\r\n\r\noutput/generated.json\n"),
    ['src/index.ts', 'output/generated.json'],
  );
  const deletedTrackedFileFixture = await mkdtemp(path.join(tmpdir(), 'generated-files-deleted-'));
  await mkdir(path.join(deletedTrackedFileFixture, 'src'));
  await writeFile(path.join(deletedTrackedFileFixture, 'src', 'index.ts'), 'export {};\n');
  assert.deepEqual(
    filterExistingTrackedFiles(
      ['src/index.ts', '.patches-JtbPSD/guidance-ts+1.0.0.patch'],
      deletedTrackedFileFixture,
    ),
    ['src/index.ts'],
  );

  const gitIndexFixture = await mkdtemp(path.join(tmpdir(), 'generated-files-git-index-'));
  const gitDir = path.join(gitIndexFixture, '.git-worktree');
  await mkdir(gitDir);
  await writeFile(path.join(gitIndexFixture, '.git'), 'gitdir: .git-worktree\n');
  await writeFile(path.join(gitDir, 'index'), createGitIndex([
    'src/index.ts',
    'output/dev-server/log.txt',
    'lib/example/src/index.ts',
  ]));
  assert.deepEqual(readTrackedFilesFromGitIndex(gitIndexFixture), [
    'src/index.ts',
    'output/dev-server/log.txt',
    'lib/example/src/index.ts',
  ]);

  console.log('agent-browser script regression checks passed');
}

await main();
