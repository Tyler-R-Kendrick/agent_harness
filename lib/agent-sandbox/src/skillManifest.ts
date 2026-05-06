export interface SkillManifest {
  id: string;
  runtime: 'quickjs';
  entry: string;
  permissions: {
    network: boolean;
    storage: 'none' | 'skill-local';
    dom: false;
  };
  exports?: string[];
}

export interface SkillManifestOptions {
  allowNetwork?: boolean;
}

type ManifestRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ManifestRecord {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseJson(input: string | Uint8Array): unknown {
  try {
    const text = typeof input === 'string' ? input : new TextDecoder().decode(input);
    return JSON.parse(text);
  } catch {
    throw new Error('Skill manifest must be valid JSON.');
  }
}

export function parseSkillManifest(input: string | Uint8Array, options: SkillManifestOptions = {}): SkillManifest {
  const parsed = parseJson(input);
  if (!isRecord(parsed)) {
    throw new Error('Skill manifest must be a JSON object.');
  }
  if (!isNonEmptyString(parsed.id)) {
    throw new Error('Skill manifest requires a non-empty id.');
  }
  if (parsed.runtime !== 'quickjs') {
    throw new Error('Skill manifest runtime must be "quickjs".');
  }
  if (!isNonEmptyString(parsed.entry)) {
    throw new Error('Skill manifest requires a non-empty entry path.');
  }

  const permissions = isRecord(parsed.permissions) ? parsed.permissions : {};
  if (permissions.dom !== undefined && permissions.dom !== false) {
    throw new Error('Skill manifests cannot request DOM access.');
  }

  const network = permissions.network === true;
  if (network && !options.allowNetwork) {
    throw new Error('Skill manifest requested network access, but this provider does not allow network access.');
  }

  const storage = permissions.storage ?? 'none';
  if (storage !== 'none' && storage !== 'skill-local') {
    throw new Error('Skill manifest storage permission must be "none" or "skill-local".');
  }

  if (parsed.exports !== undefined && (!Array.isArray(parsed.exports) || !parsed.exports.every((entry) => typeof entry === 'string'))) {
    throw new Error('Skill manifest exports must be an array of strings.');
  }

  return {
    id: parsed.id,
    runtime: 'quickjs',
    entry: parsed.entry,
    permissions: {
      network,
      storage,
      dom: false,
    },
    exports: parsed.exports as string[] | undefined,
  };
}
