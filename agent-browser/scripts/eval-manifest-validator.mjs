import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_FILENAME = 'evals.json';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function toDisplayPath(filePath, repoRoot) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

export async function findEvalManifestPaths(repoRoot) {
  const manifests = [];
  const ignored = new Set(['.git', 'node_modules', '.npm-cache', 'dist', 'coverage']);

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (ignored.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === MANIFEST_FILENAME) {
        manifests.push(entryPath);
      }
    }
  }

  await walk(repoRoot);
  manifests.sort((left, right) => left.localeCompare(right));
  return manifests;
}

export function validateEvalManifestContent(rawContent, manifestPath, repoRoot) {
  let manifest;
  try {
    manifest = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(`Invalid JSON in ${toDisplayPath(manifestPath, repoRoot)}: ${error.message}`);
  }

  const errors = [];
  const displayPath = toDisplayPath(manifestPath, repoRoot);
  const skillRoot = path.dirname(path.dirname(manifestPath));
  const expectedSkillName = path.basename(skillRoot);

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('Manifest root must be an object.');
  }

  if (!isNonEmptyString(manifest?.skill_name)) {
    errors.push('`skill_name` must be a non-empty string.');
  } else if (manifest.skill_name !== expectedSkillName) {
    errors.push(`\`skill_name\` must match the skill directory name \`${expectedSkillName}\`.`);
  }

  if (!Array.isArray(manifest?.evals) || manifest.evals.length === 0) {
    errors.push('`evals` must be a non-empty array.');
  }

  const seenIds = new Set();
  if (Array.isArray(manifest?.evals)) {
    for (const [index, evalCase] of manifest.evals.entries()) {
      const label = `evals[${index}]`;
      if (!evalCase || typeof evalCase !== 'object' || Array.isArray(evalCase)) {
        errors.push(`${label} must be an object.`);
        continue;
      }

      if (!Number.isInteger(evalCase.id) || evalCase.id <= 0) {
        errors.push(`${label}.id must be a positive integer.`);
      } else if (seenIds.has(evalCase.id)) {
        errors.push(`${label}.id must be unique; found duplicate id ${evalCase.id}.`);
      } else {
        seenIds.add(evalCase.id);
      }

      if (!isNonEmptyString(evalCase.prompt)) {
        errors.push(`${label}.prompt must be a non-empty string.`);
      }

      if (!isNonEmptyString(evalCase.expected_output)) {
        errors.push(`${label}.expected_output must be a non-empty string.`);
      }

      if (!Array.isArray(evalCase.files)) {
        errors.push(`${label}.files must be an array.`);
      } else {
        const seenFiles = new Set();
        for (const filePath of evalCase.files) {
          if (!isNonEmptyString(filePath)) {
            errors.push(`${label}.files entries must be non-empty strings.`);
            continue;
          }

          const normalizedFile = filePath.replace(/\\/g, '/');
          if (path.isAbsolute(normalizedFile) || normalizedFile.startsWith('../') || normalizedFile.includes('/../')) {
            errors.push(`${label}.files entry \`${normalizedFile}\` must stay within the skill root.`);
            continue;
          }

          if (seenFiles.has(normalizedFile)) {
            errors.push(`${label}.files entry \`${normalizedFile}\` must be unique within the eval.`);
            continue;
          }

          seenFiles.add(normalizedFile);
        }
      }

      if (evalCase.expectations !== undefined) {
        if (!Array.isArray(evalCase.expectations)) {
          errors.push(`${label}.expectations must be an array when present.`);
        } else if (evalCase.expectations.some((expectation) => !isNonEmptyString(expectation))) {
          errors.push(`${label}.expectations entries must be non-empty strings.`);
        }
      }

      if ((!Array.isArray(evalCase.files) || evalCase.files.length === 0) && (!Array.isArray(evalCase.expectations) || evalCase.expectations.length === 0)) {
        errors.push(`${label} must include at least one fixture path or expectation.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid eval manifest ${displayPath}:\n- ${errors.join('\n- ')}`);
  }

  return manifest;
}

export async function validateEvalManifestFile(manifestPath, repoRoot) {
  const rawContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = validateEvalManifestContent(rawContent, manifestPath, repoRoot);
  const skillRoot = path.dirname(path.dirname(manifestPath));
  const displayPath = toDisplayPath(manifestPath, repoRoot);

  for (const [index, evalCase] of manifest.evals.entries()) {
    for (const relativeFile of evalCase.files) {
      const candidatePaths = [
        path.resolve(skillRoot, relativeFile),
        path.resolve(repoRoot, relativeFile),
      ];
      let foundFile = false;

      for (const candidatePath of candidatePaths) {
        try {
          const stats = await fs.stat(candidatePath);
          if (stats.isFile()) {
            foundFile = true;
            break;
          }
        } catch {
          // Keep checking alternate roots.
        }
      }

      if (!foundFile) {
        throw new Error(`Invalid eval manifest ${displayPath}:\n- evals[${index}].files references missing file \`${relativeFile.replace(/\\/g, '/')}\`.`);
      }
    }
  }

  return {
    manifest,
    evalCount: manifest.evals.length,
  };
}

export async function validateRepoEvalManifests(repoRoot) {
  const manifestPaths = await findEvalManifestPaths(repoRoot);
  const results = [];

  for (const manifestPath of manifestPaths) {
    results.push(await validateEvalManifestFile(manifestPath, repoRoot));
  }

  return {
    manifestCount: results.length,
    evalCount: results.reduce((total, result) => total + result.evalCount, 0),
  };
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
  const summary = await validateRepoEvalManifests(repoRoot);
  process.stdout.write(`Validated ${summary.manifestCount} eval manifests covering ${summary.evalCount} eval cases.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
