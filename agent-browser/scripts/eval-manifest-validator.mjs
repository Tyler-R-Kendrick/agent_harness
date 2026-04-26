import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const EVALS_FILENAME = 'evals.json';

function fail(message) {
  throw new Error(message);
}

function ensureNonEmptyString(value, label, context) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${context} must include a non-empty ${label}.`);
  }
}

function ensureStringArray(value, label, context) {
  if (!Array.isArray(value)) {
    fail(`${context} must include a ${label} array.`);
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      fail(`${context} ${label}[${index}] must be a non-empty string.`);
    }
  });
}

function resolveSkillFile(manifestPath, filePath) {
  const skillRoot = path.resolve(path.dirname(manifestPath), '..');
  const skillRelative = path.resolve(skillRoot, filePath);
  const repoRelative = path.resolve(REPO_ROOT, filePath);
  return [skillRelative, repoRelative];
}

export function validateManifestText(text, manifestPath) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`${manifestPath} contains invalid JSON: ${reason}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`${manifestPath} must contain a JSON object.`);
  }

  ensureNonEmptyString(parsed.skill_name, 'skill_name', manifestPath);

  if (!Array.isArray(parsed.evals) || parsed.evals.length === 0) {
    fail(`${manifestPath} must contain a non-empty evals array.`);
  }

  const seenIds = new Set();

  for (const [index, entry] of parsed.evals.entries()) {
    const context = `${manifestPath} evals[${index}]`;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`${context} must be an object.`);
    }

    if (!Number.isInteger(entry.id)) {
      fail(`${context} id must be an integer.`);
    }

    if (seenIds.has(entry.id)) {
      fail(`${manifestPath} contains duplicate eval id ${entry.id}.`);
    }
    seenIds.add(entry.id);

    ensureNonEmptyString(entry.prompt, 'prompt', context);
    ensureNonEmptyString(entry.expected_output, 'expected_output', context);
    ensureStringArray(entry.files ?? [], 'files', context);

    if (entry.expectations !== undefined) {
      ensureStringArray(entry.expectations, 'expectations', context);
    }

    const fileCount = entry.files.length;
    const expectationCount = Array.isArray(entry.expectations) ? entry.expectations.length : 0;

    if (fileCount === 0 && expectationCount === 0) {
      fail(`${context} must include at least one file or expectation.`);
    }

    const seenFiles = new Set();
    for (const filePath of entry.files) {
      if (seenFiles.has(filePath)) {
        fail(`${context} contains duplicate file reference ${filePath}.`);
      }
      seenFiles.add(filePath);
    }
  }

  return parsed;
}

export async function validateManifestFile(manifestPath) {
  const manifest = validateManifestText(await readFile(manifestPath, 'utf8'), manifestPath);

  for (const entry of manifest.evals) {
    for (const filePath of entry.files) {
      const candidatePaths = resolveSkillFile(manifestPath, filePath);
      const exists = await Promise.any(
        candidatePaths.map(async (candidatePath) => {
          const info = await stat(candidatePath);
          return info.isFile() ? candidatePath : Promise.reject(new Error(`${candidatePath} is not a file`));
        }),
      ).catch(() => null);

      if (!exists) {
        fail(`${manifestPath} references missing file ${filePath}. Checked ${candidatePaths.join(' and ')}.`);
      }
    }
  }

  return manifest;
}

export async function findEvalManifestPaths(skillsDir = SKILLS_DIR) {
  const manifests = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === EVALS_FILENAME && path.basename(path.dirname(fullPath)) === 'evals') {
        manifests.push(fullPath);
      }
    }
  }

  await walk(skillsDir);
  manifests.sort();
  return manifests;
}

export async function runValidation(skillsDir = SKILLS_DIR) {
  const manifests = await findEvalManifestPaths(skillsDir);
  let evalCount = 0;

  for (const manifestPath of manifests) {
    const manifest = await validateManifestFile(manifestPath);
    evalCount += manifest.evals.length;
  }

  return { manifestCount: manifests.length, evalCount };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const { manifestCount, evalCount } = await runValidation();
  console.log(`Validated ${manifestCount} eval manifests with ${evalCount} total evals.`);
}
