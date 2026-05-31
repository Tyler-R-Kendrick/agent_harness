import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIPPED_DIRS = new Set(['.git', '.npm-cache', 'coverage', 'node_modules']);
const TEST_FILE_DENYLISTS_BY_EXTENSION = new Map([
  ['ts', '!src/**/*.test.ts'],
  ['tsx', '!src/**/*.test.tsx'],
]);
const SOURCE_TEST_DIRECTORY_DENYLIST = '!src/__tests__/**';
const DIST_SOURCE_MAP_DENYLIST = '!dist/**/*.map';

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

function recursiveSrcPatternExtensions(files) {
  const extensions = new Set();

  for (const pattern of files) {
    const normalized = normalizePath(pattern);
    if (normalized.startsWith('!') || !normalized.startsWith('src/**/')) continue;

    const basenamePattern = normalized.slice('src/**/'.length);
    if (!basenamePattern.startsWith('*.')) continue;

    const extensionPattern = basenamePattern.slice(2);
    if (TEST_FILE_DENYLISTS_BY_EXTENSION.has(extensionPattern)) {
      extensions.add(extensionPattern);
      continue;
    }

    if (extensionPattern.startsWith('{') && extensionPattern.endsWith('}')) {
      for (const extension of extensionPattern
        .slice(1, -1)
        .split(',')
        .map((value) => value.trim())) {
        if (TEST_FILE_DENYLISTS_BY_EXTENSION.has(extension)) {
          extensions.add(extension);
        }
      }
    }
  }

  return extensions;
}

function includesRecursiveDistPattern(files) {
  return files.some((pattern) => {
    const normalized = normalizePath(pattern);
    return !normalized.startsWith('!') && (normalized === 'dist/**' || normalized === 'dist/**/*');
  });
}

export function findPackagePublishAllowlistIssues(packages) {
  return packages
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ path: packagePath, manifest }) => {
      const files = Array.isArray(manifest.files) ? manifest.files.map(String) : [];
      const normalizedFiles = files.map(normalizePath);
      const issues = [];

      if (files.length === 0) {
        issues.push('missing package.json files allowlist');
      }

      const recursiveExtensions = recursiveSrcPatternExtensions(files);
      for (const extension of recursiveExtensions) {
        const denylist = TEST_FILE_DENYLISTS_BY_EXTENSION.get(extension);
        if (!normalizedFiles.includes(denylist)) {
          issues.push(`missing ${denylist} for recursive src ${extension} publish pattern`);
        }
      }

      if (recursiveExtensions.size > 0 && !normalizedFiles.includes(SOURCE_TEST_DIRECTORY_DENYLIST)) {
        issues.push(`missing ${SOURCE_TEST_DIRECTORY_DENYLIST} for recursive src publish pattern`);
      }

      if (includesRecursiveDistPattern(files) && !normalizedFiles.includes(DIST_SOURCE_MAP_DENYLIST)) {
        issues.push(`missing ${DIST_SOURCE_MAP_DENYLIST} for recursive dist publish pattern`);
      }

      return {
        name: manifest.name ?? '(unnamed package)',
        path: normalizePath(packagePath),
        issues,
      };
    })
    .filter((pkg) => pkg.issues.length > 0);
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

export function formatPublishAllowlistIssues(packages) {
  return [
    'Publishable workspace packages must keep package.json files allowlists explicit and test-free:',
    ...packages.flatMap((pkg) => [
      `- ${pkg.path} (${pkg.name})`,
      ...pkg.issues.map((issue) => `  - ${issue}`),
    ]),
  ].join('\n');
}

export function runPackagePublishAllowlistCli({
  packages = readWorkspacePackages(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const issues = findPackagePublishAllowlistIssues(packages);
  if (issues.length > 0) {
    stderr.write(`${formatPublishAllowlistIssues(issues)}\n`);
    return 1;
  }

  stdout.write('All publishable workspace packages declare explicit, test-free files allowlists.\n');
  return 0;
}

/* node:coverage disable */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPackagePublishAllowlistCli();
}
/* node:coverage enable */
