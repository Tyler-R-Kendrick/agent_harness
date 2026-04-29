import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';

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

  const verifyScript = await readScript('scripts/verify-agent-browser.ps1');
  const testScriptsIndex = verifyScript.indexOf("Label = 'test-scripts'");
  const lintIndex = verifyScript.indexOf("Label = 'lint'");
  const buildIndex = verifyScript.indexOf("Label = 'build'");
  assert.notEqual(testScriptsIndex, -1);
  assert.notEqual(lintIndex, -1);
  assert.notEqual(buildIndex, -1);
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

  console.log('agent-browser script regression checks passed');
}

await main();
