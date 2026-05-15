import type { SkillDefinition } from './skillContracts';

export type SkillRegistrySource = 'core' | 'extension';

export interface SkillDescriptor {
  id: string;
  enabled?: boolean;
}

export interface SkillPackManifest {
  id: string;
  version: string;
  policy?: 'allow' | 'deny';
  skills: SkillDescriptor[];
}

export interface SkillPackRegistration {
  source: SkillRegistrySource;
  manifest: unknown;
}

export interface SkillPackDiagnostic {
  code:
    | 'missing-field'
    | 'invalid-field-type'
    | 'duplicate-pack-id'
    | 'duplicate-skill-id'
    | 'unsupported-policy';
  path: string;
  message: string;
}

export interface SkillRegistryEntry {
  id: string;
  source: SkillRegistrySource;
  enabled: boolean;
  packId: string;
  packVersion: string;
}

export interface SkillRegistryResult {
  skills: SkillRegistryEntry[];
  diagnostics: SkillPackDiagnostic[];
}

export interface SkillRegistryConfig {
  extensionPacks?: unknown[];
}

export interface SkillRegistryIntrospection {
  skills: SkillRegistryEntry[];
  bySource: Record<SkillRegistrySource, SkillRegistryEntry[]>;
  diagnostics: SkillPackDiagnostic[];
}

const SUPPORTED_POLICIES = new Set(['allow', 'deny']);

export function createSkillRegistry(
  corePacks: unknown[],
  config: SkillRegistryConfig = {},
): SkillRegistryIntrospection {
  const registrations: SkillPackRegistration[] = [
    ...corePacks.map((manifest) => ({ source: 'core' as const, manifest })),
    ...(config.extensionPacks ?? []).map((manifest) => ({ source: 'extension' as const, manifest })),
  ];

  const result = registerSkillPacks(registrations);
  return {
    ...result,
    bySource: {
      core: result.skills.filter((skill) => skill.source === 'core'),
      extension: result.skills.filter((skill) => skill.source === 'extension'),
    },
  };
}

export function registerSkillPacks(registrations: SkillPackRegistration[]): SkillRegistryResult {
  const diagnostics: SkillPackDiagnostic[] = [];
  const skills: SkillRegistryEntry[] = [];
  const seenPackIds = new Set<string>();
  const seenSkillIds = new Set<string>();

  for (const registration of registrations) {
    const parsed = parseSkillPackManifest(registration.manifest, diagnostics, registration.source);
    if (!parsed) continue;

    if (seenPackIds.has(parsed.id)) {
      diagnostics.push({
        code: 'duplicate-pack-id',
        path: 'id',
        message: `Duplicate skill pack id: ${parsed.id}`,
      });
      continue;
    }
    seenPackIds.add(parsed.id);

    for (const skill of parsed.skills) {
      if (seenSkillIds.has(skill.id)) {
        diagnostics.push({
          code: 'duplicate-skill-id',
          path: 'skills[].id',
          message: `Duplicate skill id: ${skill.id}`,
        });
        continue;
      }
      seenSkillIds.add(skill.id);
      skills.push({
        id: skill.id,
        enabled: skill.enabled ?? true,
        source: registration.source,
        packId: parsed.id,
        packVersion: parsed.version,
      });
    }
  }

  return { skills, diagnostics };
}

function parseSkillPackManifest(
  value: unknown,
  diagnostics: SkillPackDiagnostic[],
  source: SkillRegistrySource,
): SkillPackManifest | null {
  if (!isRecord(value)) {
    diagnostics.push({
      code: 'invalid-field-type',
      path: 'manifest',
      message: `Skill pack manifest must be an object (${source}).`,
    });
    return null;
  }

  const id = requireStringField(value, 'id', diagnostics);
  const version = requireStringField(value, 'version', diagnostics);

  if (!Array.isArray(value.skills)) {
    diagnostics.push({
      code: value.skills == null ? 'missing-field' : 'invalid-field-type',
      path: 'skills',
      message: 'Skill pack skills must be an array.',
    });
    return null;
  }

  const policy = value.policy;
  if (policy != null && (typeof policy !== 'string' || !SUPPORTED_POLICIES.has(policy))) {
    diagnostics.push({
      code: 'unsupported-policy',
      path: 'policy',
      message: `Unsupported skill pack policy: ${String(policy)}`,
    });
    return null;
  }

  const skills: SkillDescriptor[] = [];
  for (const [index, skill] of value.skills.entries()) {
    if (!isRecord(skill)) {
      diagnostics.push({
        code: 'invalid-field-type',
        path: `skills[${index}]`,
        message: 'Skill entry must be an object.',
      });
      continue;
    }

    const skillId = requireStringField(skill, 'id', diagnostics, `skills[${index}]`);
    if (!skillId) continue;

    if (skill.enabled != null && typeof skill.enabled !== 'boolean') {
      diagnostics.push({
        code: 'invalid-field-type',
        path: `skills[${index}].enabled`,
        message: 'Skill enabled must be boolean when provided.',
      });
      continue;
    }

    skills.push({ id: skillId, enabled: skill.enabled as boolean | undefined });
  }

  if (!id || !version) return null;
  return { id, version, policy: policy as 'allow' | 'deny' | undefined, skills };
}

function requireStringField(
  value: Record<string, unknown>,
  field: string,
  diagnostics: SkillPackDiagnostic[],
  pathPrefix = '',
): string | null {
  const path = pathPrefix ? `${pathPrefix}.${field}` : field;
  if (!(field in value)) {
    diagnostics.push({ code: 'missing-field', path, message: `Missing required field: ${path}` });
    return null;
  }
  if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
    diagnostics.push({ code: 'invalid-field-type', path, message: `Field must be a non-empty string: ${path}` });
    return null;
  }
  return value[field] as string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }
}
