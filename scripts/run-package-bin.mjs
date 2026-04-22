import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const [, , packageName, ...args] = process.argv;

if (!packageName) {
  console.error('Usage: node scripts/run-package-bin.mjs <package-name> [args...]');
  process.exit(1);
}

const cwd = process.cwd();
const requireFromCwd = createRequire(path.join(cwd, 'package.json'));

let packageJsonPath;

try {
  packageJsonPath = requireFromCwd.resolve(`${packageName}/package.json`);
} catch (error) {
  console.error(`Unable to resolve ${packageName} from ${cwd}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const { bin } = packageJson;

let binRelativePath;

if (typeof bin === 'string') {
  binRelativePath = bin;
} else if (bin && typeof bin === 'object') {
  const defaultBinName = packageName.split('/').pop();
  binRelativePath = bin[packageName] ?? bin[defaultBinName] ?? Object.values(bin)[0];
}

if (!binRelativePath) {
  console.error(`Package ${packageName} does not declare a runnable bin entry`);
  process.exit(1);
}

const binPath = path.resolve(path.dirname(packageJsonPath), binRelativePath);
const child = spawn(process.execPath, [binPath, ...args], {
  cwd,
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start ${packageName}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});