import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIPPED_DIRS = new Set(['.git', '.npm-cache', 'coverage', 'node_modules']);

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function expandWorkspacePattern(root, pattern) {
  const segments = normalizePath(pattern).split('/');
  const matches = [];

  function walk(currentPath, index) {
    if (index === segments.length) {
      const packagePath = path.join(currentPath, 'package.json');
      if (existsSync(packagePath)) {
        matches.push(packagePath);
      }
      return;
    }

    const segment = segments[index];
    if (segment !== '*') {
      walk(path.join(currentPath, segment), index + 1);
      return;
    }

    if (!existsSync(currentPath)) return;
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIPPED_DIRS.has(entry.name)) continue;
      walk(path.join(currentPath, entry.name), index + 1);
    }
  }

  walk(root, 0);
  return matches;
}

export function findPublishablePackagesWithoutFiles(packages) {
  return packages
    .filter(({ manifest }) => manifest.private !== true)
    .filter(({ manifest }) => !Array.isArray(manifest.files) || manifest.files.length === 0)
    .map(({ path: packagePath, manifest }) => ({
      name: manifest.name ?? '(unnamed package)',
      path: normalizePath(packagePath),
    }));
}

export function readWorkspacePackages(root = repoRoot()) {
  const rootManifest = readJson(path.join(root, 'package.json'));
  const workspacePatterns = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : [];
  const packagePaths = new Set();

  for (const pattern of workspacePatterns) {
    for (const packagePath of expandWorkspacePattern(root, pattern)) {
      packagePaths.add(packagePath);
    }
  }

  return [...packagePaths].sort().map((packagePath) => ({
    path: normalizePath(path.relative(root, packagePath)),
    manifest: readJson(packagePath),
  }));
}

export function formatMissingAllowlists(packages) {
  return [
    'Publishable workspace packages must declare an explicit package.json files allowlist:',
    ...packages.map((pkg) => `- ${pkg.path} (${pkg.name})`),
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const missing = findPublishablePackagesWithoutFiles(readWorkspacePackages());
  if (missing.length > 0) {
    process.stderr.write(`${formatMissingAllowlists(missing)}\n`);
    process.exit(1);
  }

  process.stdout.write('All publishable workspace packages declare package files allowlists.\n');
}
