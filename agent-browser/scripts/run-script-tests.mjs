import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';
import {
  buildGitLsFilesInvocation,
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
  assert.match(visualSmokeScript, /PR review understanding/);
  assert.match(visualSmokeScript, /TK-47 review-native PR understanding/);
  assert.match(visualSmokeScript, /Browser evidence for selected diff/);
  assert.match(visualSmokeScript, /Agent Browser visual smoke/);
  assert.match(visualSmokeScript, /2 assertions passed/);
  assert.match(visualSmokeScript, /captureGitWorktreeViewportMatrix/);
  assert.match(visualSmokeScript, /agent-browser-git-worktree-mobile\.png/);
  assert.match(visualSmokeScript, /agent-browser-git-worktree-tablet\.png/);
  assert.match(visualSmokeScript, /agent-browser-git-worktree-wide\.png/);
  assert.match(visualSmokeScript, /Repository wiki/);
  assert.match(visualSmokeScript, /agent-browser-repository-wiki\.png/);
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
  assert.match(visualSmokeScript, /Scheduled automations/);
  assert.match(visualSmokeScript, /Enable Daily workspace audit/);
  assert.match(visualSmokeScript, /Typed run SDK/);
  assert.match(visualSmokeScript, /Structured event stream/);
  assert.match(visualSmokeScript, /Reconnect cursor/);
  assert.match(visualSmokeScript, /agent-browser-typed-run-sdk\.png/);
  assert.doesNotMatch(visualSmokeScript, /waitUntil:\s*'networkidle'/);

  const packageJson = await readScript('package.json');
  const rootPackage = JSON.parse(packageJson);
  assert.ok(rootPackage.workspaces.includes('ext/*/*'));
  assert.equal(rootPackage.scripts['lint:extensions'], 'node scripts/run-extension-workspaces.mjs lint');
  assert.equal(rootPackage.scripts['build:extensions'], 'node scripts/run-extension-workspaces.mjs build');
  assert.equal(rootPackage.scripts['build:extension-downloads'], 'node scripts/package-extension-downloads.mjs');
  assert.equal(rootPackage.scripts['test:extensions'], 'node scripts/run-extension-workspaces.mjs test');
  assert.equal(rootPackage.scripts['test:coverage:extensions'], 'node scripts/run-extension-workspaces.mjs test:coverage');
  assert.match(packageJson, /"verify:agent-browser": "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\/verify-agent-browser\.ps1"/);
  assert.match(packageJson, /"check:generated-files": "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\/check-generated-files-clean\.ps1"/);
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
  const previewExtensionPackageJson = JSON.parse(
    await readScript('tools/agent-browser-preview-extension/extension/package.json'),
  );
  assert.deepEqual(previewExtensionPackageJson.files, [
    'main.js',
    'logic.js',
  ]);
  const vercelConfig = JSON.parse(await readScript('vercel.json'));
  assert.equal(vercelConfig.installCommand, 'node scripts/vercel-install.mjs');
  assert.equal(vercelConfig.buildCommand, 'cd agent-browser && npm run build');
  assert.equal(vercelConfig.outputDirectory, 'agent-browser/dist');

  const vercelInstall = await import(pathToFileURL(path.resolve(repoRoot, 'scripts/vercel-install.mjs')).href);
  assert.equal(vercelInstall.getNpmExecutable('win32'), 'npm.cmd');
  assert.equal(vercelInstall.getNpmExecutable('linux'), 'npm');
  assert.equal(vercelInstall.usesShellForPlatform('win32'), true);
  assert.equal(vercelInstall.usesShellForPlatform('linux'), false);
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
  const harnessCoreNodeModules = path.join(lockfileFixture, 'harness-core', 'node_modules');
  const extensionNodeModules = path.join(
    lockfileFixture,
    'ext',
    'provider',
    'local-model-connector',
    'node_modules',
  );
  await mkdir(path.dirname(workspaceLockfile), { recursive: true });
  await mkdir(rootNodeModules);
  await mkdir(workspaceNodeModules);
  await mkdir(harnessCoreNodeModules, { recursive: true });
  await mkdir(extensionNodeModules, { recursive: true });
  await writeFile(rootLockfile, '{}');
  await writeFile(workspaceLockfile, '{}');
  await writeJson(path.join(path.dirname(extensionNodeModules), 'package.json'), {
    name: '@agent-harness/local-model-connector',
  });
  await vercelInstall.removeCachedLockfiles(lockfileFixture);
  await assert.rejects(() => readFile(rootLockfile), { code: 'ENOENT' });
  await assert.rejects(() => readFile(workspaceLockfile), { code: 'ENOENT' });
  await assert.rejects(() => stat(rootNodeModules), { code: 'ENOENT' });
  await assert.rejects(() => stat(workspaceNodeModules), { code: 'ENOENT' });
  await assert.rejects(() => stat(harnessCoreNodeModules), { code: 'ENOENT' });
  await assert.rejects(() => stat(extensionNodeModules), { code: 'ENOENT' });
  await vercelInstall.removeCachedLockfiles(lockfileFixture);

  const coverageRunner = await import(
    pathToFileURL(path.resolve(repoRoot, 'agent-browser/scripts/run-vitest-coverage.mjs')).href
  );
  const extensionRunner = await import(
    pathToFileURL(path.resolve(repoRoot, 'scripts/run-extension-workspaces.mjs')).href
  );
  const extensionDownloadsPackager = await import(
    pathToFileURL(path.resolve(repoRoot, 'scripts/package-extension-downloads.mjs')).href
  );
  const workspacePatchApplicator = await import(
    pathToFileURL(path.resolve(repoRoot, 'scripts/apply-workspace-patches.mjs')).href
  );
  const extensionDownloadsScript = await readScript('scripts/package-extension-downloads.mjs');
  assert.match(extensionDownloadsScript, /pathToFileURL\(path\.resolve\(process\.argv\[1\]\)\)\.href/);
  assert.deepEqual(extensionDownloadsPackager.buildDownloadPackages(repoRoot), [
    {
      name: 'local-model-connector-extension',
      sourceDirectory: path.join(repoRoot, 'ext', 'provider', 'local-model-connector', 'dist'),
      outputFile: path.join(repoRoot, 'agent-browser', 'public', 'downloads', 'local-model-connector-extension.zip'),
    },
    {
      name: 'agent-harness-local-inference-daemon',
      sourceDirectory: path.join(repoRoot, 'agent-daemon'),
      outputFile: path.join(repoRoot, 'agent-browser', 'public', 'downloads', 'agent-harness-local-inference-daemon.zip'),
    },
  ]);
  assert.deepEqual(extensionDownloadsPackager.buildWindowsDaemonBinaryDownloads(repoRoot), [
    {
      sourceFile: path.join(repoRoot, 'agent-daemon', 'dist', 'agent-harness-local-inference-daemon-windows-x64.exe'),
      publicFile: path.join(repoRoot, 'agent-browser', 'public', 'downloads', 'agent-harness-local-inference-daemon-windows-x64.exe'),
      extensionFile: path.join(
        repoRoot,
        'ext',
        'worker',
        'local-inference-worker',
        'dist',
        'agent-harness-local-inference-daemon-windows-x64.exe',
      ),
    },
  ]);
  assert.deepEqual(extensionDownloadsPackager.normalizeZipEntryPath('agent-daemon', 'src\\mod.ts'), 'agent-daemon/src/mod.ts');

  const extensionZipFixture = await mkdtemp(path.join(tmpdir(), 'extension-download-zip-'));
  const extensionZipSource = path.join(extensionZipFixture, 'dist');
  const extensionZipOutput = path.join(extensionZipFixture, 'download.zip');
  await mkdir(extensionZipSource);
  await writeFile(path.join(extensionZipSource, 'background.js'), 'console.log("runtime");');
  await writeFile(path.join(extensionZipSource, 'background.js.map'), '{"version":3}');
  await extensionDownloadsPackager.createZipFromDirectory(extensionZipSource, extensionZipOutput, 'extension');
  const extensionZip = await readFile(extensionZipOutput);
  assert.match(extensionZip.toString('latin1'), /extension\/background\.js/);
  assert.doesNotMatch(extensionZip.toString('latin1'), /extension\/background\.js\.map/);

  const patchFixture = await mkdtemp(path.join(tmpdir(), 'workspace-patches-'));
  await mkdir(path.join(patchFixture, 'node_modules', '@tavily', 'core'), { recursive: true });
  assert.equal(
    workspacePatchApplicator.resolveInstalledPackagePath(
      patchFixture,
      'agent-browser',
      'node_modules/@tavily/core',
    ),
    path.join(patchFixture, 'node_modules', '@tavily', 'core'),
  );
  assert.equal(
    workspacePatchApplicator.resolvePatchWorkingDirectory(
      patchFixture,
      'agent-browser',
      path.join(patchFixture, 'node_modules', '@tavily', 'core'),
    ),
    patchFixture,
  );

  const extensionFixture = await mkdtemp(path.join(tmpdir(), 'extension-workspaces-'));
  await mkdir(path.join(extensionFixture, 'ext', 'ide', 'alpha'), { recursive: true });
  await mkdir(path.join(extensionFixture, 'ext', 'ide', 'not-a-package'), { recursive: true });
  await mkdir(path.join(extensionFixture, 'ext', 'runtime', 'beta'), { recursive: true });
  await writeJson(path.join(extensionFixture, 'ext', 'ide', 'alpha', 'package.json'), {
    name: '@agent-harness/ext-alpha',
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
  const coverageRunnerScript = await readScript('agent-browser/scripts/run-vitest-coverage.mjs');
  assert.match(coverageRunnerScript, /DEFAULT_COVERAGE_BATCH_CONCURRENCY = 4/);
  assert.match(coverageRunnerScript, /runVitestCommandsConcurrently/);
  assert.match(coverageRunnerScript, /runVitestCommandWithRetry/);
  assert.match(coverageRunnerScript, /retrying once/);
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
  const validateEvalsIndex = verifyScript.indexOf("Label = 'validate-evals'");
  const testScriptsIndex = verifyScript.indexOf("Label = 'test-scripts'");
  const evalWorkflowsIndex = verifyScript.indexOf("Label = 'eval-workflows'");
  const extensionLintIndex = verifyScript.indexOf("Label = 'extension-lint'");
  const extensionCoverageIndex = verifyScript.indexOf("Label = 'extension-coverage'");
  const extensionBuildIndex = verifyScript.indexOf("Label = 'extension-build'");
  const lintIndex = verifyScript.indexOf("Label = 'lint'");
  const buildIndex = verifyScript.indexOf("Label = 'build'");
  assert.notEqual(sourceHygieneIndex, -1);
  assert.notEqual(validateEvalsIndex, -1);
  assert.notEqual(testScriptsIndex, -1);
  assert.notEqual(evalWorkflowsIndex, -1);
  assert.notEqual(extensionLintIndex, -1);
  assert.notEqual(extensionCoverageIndex, -1);
  assert.notEqual(extensionBuildIndex, -1);
  assert.notEqual(lintIndex, -1);
  assert.notEqual(buildIndex, -1);
  assert.ok(sourceHygieneIndex < validateEvalsIndex);
  assert.ok(testScriptsIndex < evalWorkflowsIndex);
  assert.ok(evalWorkflowsIndex < extensionLintIndex);
  assert.ok(extensionLintIndex < extensionCoverageIndex);
  assert.ok(extensionCoverageIndex < extensionBuildIndex);
  assert.ok(extensionBuildIndex < lintIndex);
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
    'output/evals/search-fulfillment-agentv/timing.json',
    'output/dev-server/agent-browser-5174.out.log',
    '.npm-cache/_logs/2026-05-02T00_00_00_000Z-debug-0.log',
    '_cacache/index-v5/00/00/cache-entry',
    '_logs/2026-05-02T00_00_00_000Z-debug-0.log',
    '_update-notifier-last-checked',
    '.agentv/cache.json',
    '.codex/environments/environment.toml',
    '.codex-tk26-objects/0e/6a0096338608df4fcd3f7d80dc0dcc8710d298',
    '.codex-tk26-index-main/index.json',
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
      'output/evals/search-fulfillment-agentv/timing.json',
      'output/dev-server/agent-browser-5174.out.log',
      '.npm-cache/_logs/2026-05-02T00_00_00_000Z-debug-0.log',
      '_cacache/index-v5/00/00/cache-entry',
      '_logs/2026-05-02T00_00_00_000Z-debug-0.log',
      '_update-notifier-last-checked',
      '.agentv/cache.json',
      '.codex/environments/environment.toml',
      '.codex-tk26-objects/0e/6a0096338608df4fcd3f7d80dc0dcc8710d298',
      '.codex-tk26-index-main/index.json',
    ],
  );
  assert.match(
    formatTrackedGeneratedArtifactsError(trackedArtifacts),
    /Generated or local-only artifacts are tracked by git/,
  );
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /output\/evals/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/package-lock\.json/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /coverage\/lcov\.info/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /playwright-report\/index\.html/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /test-results\/\.last-run\.json/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/tsconfig\.tsbuildinfo/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser-debug\.log/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.npm-cache\/_logs/);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /_cacache\//);
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.agentv\/cache\.json/);
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
