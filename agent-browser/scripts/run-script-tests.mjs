import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';
import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
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

async function main() {
  const visualSmokeScript = await readScript('agent-browser/scripts/visual-smoke.mjs');
  assert.match(visualSmokeScript, /waitUntil:\s*'domcontentloaded'/);
  assert.match(visualSmokeScript, /navigationTimeoutMs\s*=\s*120_000/);
  assert.match(visualSmokeScript, /shellTimeoutMs\s*=\s*30_000/);
  assert.doesNotMatch(visualSmokeScript, /waitUntil:\s*'networkidle'/);

  const packageJson = await readScript('package.json');
  assert.match(packageJson, /"verify:agent-browser": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\/verify-agent-browser\.ps1"/);
  assert.match(packageJson, /"check:generated-files": "node scripts\/check-generated-files-clean\.mjs"/);
  const agentBrowserPackageJson = await readScript('agent-browser/package.json');
  assert.match(agentBrowserPackageJson, /"test:coverage": "node scripts\/run-vitest-coverage\.mjs"/);
  const vercelConfig = JSON.parse(await readScript('vercel.json'));
  assert.equal(vercelConfig.installCommand, 'npm install');
  assert.equal(vercelConfig.buildCommand, 'cd agent-browser && npm run build');
  assert.equal(vercelConfig.outputDirectory, 'agent-browser/dist');

  const coverageRunner = await import(
    pathToFileURL(path.resolve(repoRoot, 'agent-browser/scripts/run-vitest-coverage.mjs')).href
  );
  assert.deepEqual(
    coverageRunner.buildVitestCoverageArgs(['--reporter=dot'], '../output/coverage/agent-browser-test'),
    [
      'run',
      '--coverage',
      '--coverage.processingConcurrency=1',
      '--coverage.reportsDirectory=../output/coverage/agent-browser-test',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--exclude',
      'src/App.test.tsx',
      '--exclude',
      'src/App.persistence.test.tsx',
      '--reporter=dot',
    ],
  );
  assert.deepEqual(
    coverageRunner.buildAppTestArgs(),
    [
      'run',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--reporter=dot',
      'src/App.test.tsx',
      'src/App.persistence.test.tsx',
    ],
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

  const verifyScript = await readScript('scripts/verify-agent-browser.ps1');
  const sourceHygieneIndex = verifyScript.indexOf("Label = 'source-hygiene'");
  const validateEvalsIndex = verifyScript.indexOf("Label = 'validate-evals'");
  const testScriptsIndex = verifyScript.indexOf("Label = 'test-scripts'");
  const lintIndex = verifyScript.indexOf("Label = 'lint'");
  const buildIndex = verifyScript.indexOf("Label = 'build'");
  assert.notEqual(sourceHygieneIndex, -1);
  assert.notEqual(validateEvalsIndex, -1);
  assert.notEqual(testScriptsIndex, -1);
  assert.notEqual(lintIndex, -1);
  assert.notEqual(buildIndex, -1);
  assert.ok(sourceHygieneIndex < validateEvalsIndex);
  assert.ok(testScriptsIndex < lintIndex);
  assert.ok(lintIndex < buildIndex);
  assert.match(verifyScript, /npm warn/i);
  assert.match(verifyScript, /vite:reporter/i);
  assert.match(verifyScript, /warn exec The following package was not found/i);

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
    'output/evals/search-fulfillment-agentv/timing.json',
    'output/dev-server/agent-browser-5174.out.log',
    '.agentv/cache.json',
    '.codex/environments/environment.toml',
    '.codex-tk26-objects/0e/6a0096338608df4fcd3f7d80dc0dcc8710d298',
    '.codex-tk26-index-main/index.json',
  ]);
  assert.deepEqual(
    trackedArtifacts.map((artifact) => artifact.path),
    [
      'package-lock.json',
      'output/evals/search-fulfillment-agentv/timing.json',
      'output/dev-server/agent-browser-5174.out.log',
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
  assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.agentv\/cache\.json/);

  console.log('agent-browser script regression checks passed');
}

await main();
