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
  const coreToolApiReadme = await readScript('lib/core-tool-api/README.md');
  const workerReadme = await readScript('lib/worker/README.md');
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
  assert.match(coreToolApiReadme, /## Public API/);
  assert.match(coreToolApiReadme, /## Minimal flow/);
  assert.match(coreToolApiReadme, /## Execution contract/);
  assert.match(coreToolApiReadme, /## Runtime context and provider shapes/);
  assert.match(coreToolApiReadme, /Provider selection is capability-based/);
  assert.match(coreToolApiReadme, /`requestId`/);
  assert.match(coreToolApiReadme, /`wasi-wasm`/);
  assert.match(coreToolApiReadme, /npm\.cmd --workspace @agent-harness\/core-tool-api run test:coverage/);
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
  assert.match(agentBrowserPackageJson, /"smoke:deployed-web-searc