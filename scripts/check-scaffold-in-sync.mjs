import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Directories that are generated, vendored dependency trees, or tool config —
// not semantic surfaces that SCAFFOLD.md is expected to document.
export const SCAFFOLD_IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  'output',
  'build',
]);

export function listTopLevelDirectories(cwd = process.cwd()) {
  return readdirSync(cwd, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !SCAFFOLD_IGNORED_DIRECTORIES.has(name))
    .sort();
}

export function parseDocumentedDirectories(scaffoldText) {
  const documented = new Set();
  const pattern = /`([A-Za-z0-9_.-]+)\//g;
  let match;
  while ((match = pattern.exec(scaffoldText)) !== null) {
    documented.add(match[1]);
  }
  return documented;
}

export function findUndocumentedDirectories(directories, documented) {
  return directories.filter((name) => !documented.has(name));
}

export function readScaffoldText(cwd = process.cwd()) {
  return readFileSync(path.join(cwd, 'SCAFFOLD.md'), 'utf8');
}

export function checkScaffoldInSync(cwd = process.cwd()) {
  const directories = listTopLevelDirectories(cwd);
  const documented = parseDocumentedDirectories(readScaffoldText(cwd));
  return findUndocumentedDirectories(directories, documented);
}

export function formatUndocumentedError(missing) {
  return [
    'SCAFFOLD.md is out of sync with the repository layout.',
    'The following top-level directories are not documented in SCAFFOLD.md:',
    ...missing.map((name) => `  - ${name}/`),
    'Add a semantic entry (a backtick path like `<name>/`) for each, then re-run.',
  ].join('\n');
}

export function runScaffoldInSyncCli({
  directories,
  scaffoldText,
  cwd = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const resolvedDirectories = directories ?? listTopLevelDirectories(cwd);
  const resolvedText = scaffoldText ?? readScaffoldText(cwd);
  const documented = parseDocumentedDirectories(resolvedText);
  const missing = findUndocumentedDirectories(resolvedDirectories, documented);
  if (missing.length > 0) {
    stderr.write(`${formatUndocumentedError(missing)}\n`);
    return 1;
  }
  stdout.write('SCAFFOLD.md documents every top-level directory.\n');
  return 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(runScaffoldInSyncCli());
}
