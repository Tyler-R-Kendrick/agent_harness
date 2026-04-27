import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

async function readScript(relativePath) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
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

  console.log('agent-browser script regression checks passed');
}

await main();
