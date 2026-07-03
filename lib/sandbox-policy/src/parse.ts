import { parse as parseYaml } from 'yaml';
import type {
  SandboxPolicy,
  SandboxPolicyLimits,
  SandboxPolicyNetwork,
  SandboxNetworkPolicyKind,
  SandboxStorage,
} from './types';

/** Document format for {@link parseSandboxPolicy}. */
export type SandboxPolicyFormat = 'yaml' | 'json' | 'auto';

/** Options for {@link parseSandboxPolicy}. */
export interface ParseSandboxPolicyOptions {
  /** Parser to use. Defaults to `'auto'` (JSON first, then YAML). */
  format?: SandboxPolicyFormat;
}

type UnknownRecord = Record<string, unknown>;

const KNOWN_KEYS = new Set<string>(['network', 'limits', 'storage', 'dom', 'enforcement']);

const KNOWN_NETWORK_KEYS = new Set<string>([
  'allow',
  'allowedOrigins',
  'allowedMethods',
  'allowLocalhostHttp',
  'policy',
  'maxRequestBytes',
  'maxResponseBytes',
  'timeoutMs',
]);

const LIMIT_FIELDS = [
  'maxRuntimeMs',
  'maxStdoutBytes',
  'maxStderrBytes',
  'maxLogBytes',
  'maxEventCount',
  'maxArtifactBytes',
  'maxWorkspaceBytes',
  'maxOutputBytes',
  'maxFileBytes',
  'maxTotalBytes',
  'defaultTimeoutMs',
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNetworkPolicyKind(value: unknown): value is SandboxNetworkPolicyKind {
  return value === 'deny' || value === 'restricted';
}

function parseJsonStrict(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error('Sandbox policy must be valid JSON.');
  }
}

function parseYamlStrict(input: string): unknown {
  try {
    return parseYaml(input);
  } catch {
    throw new Error('Sandbox policy must be valid YAML.');
  }
}

function parseDocument(input: string, format: SandboxPolicyFormat): unknown {
  if (format === 'json') {
    return parseJsonStrict(input);
  }
  if (format === 'yaml') {
    return parseYamlStrict(input);
  }
  try {
    return JSON.parse(input);
  } catch {
    return parseYamlStrict(input);
  }
}

function validateNonNegativeNumber(value: unknown, field: string): number {
  if (!isFiniteNumber(value) || value < 0) {
    throw new Error(`Sandbox policy ${field} must be a finite non-negative number.`);
  }
  return value;
}

function validateNetwork(value: unknown): SandboxPolicyNetwork {
  if (!isRecord(value)) {
    throw new Error('Sandbox policy network must be an object.');
  }

  for (const key of Object.keys(value)) {
    if (!KNOWN_NETWORK_KEYS.has(key)) {
      throw new Error(`Sandbox policy network has an unknown key "${key}".`);
    }
  }

  const network: SandboxPolicyNetwork = {};

  if (value.allow !== undefined) {
    if (typeof value.allow !== 'boolean') {
      throw new Error('Sandbox policy network.allow must be a boolean.');
    }
    network.allow = value.allow;
  }
  if (value.allowedOrigins !== undefined) {
    if (!isStringArray(value.allowedOrigins)) {
      throw new Error('Sandbox policy network.allowedOrigins must be an array of strings.');
    }
    network.allowedOrigins = value.allowedOrigins;
  }
  if (value.allowedMethods !== undefined) {
    if (!isStringArray(value.allowedMethods)) {
      throw new Error('Sandbox policy network.allowedMethods must be an array of strings.');
    }
    network.allowedMethods = value.allowedMethods;
  }
  if (value.allowLocalhostHttp !== undefined) {
    if (typeof value.allowLocalhostHttp !== 'boolean') {
      throw new Error('Sandbox policy network.allowLocalhostHttp must be a boolean.');
    }
    network.allowLocalhostHttp = value.allowLocalhostHttp;
  }
  if (value.policy !== undefined) {
    if (!isNetworkPolicyKind(value.policy)) {
      throw new Error('Sandbox policy network.policy must be "deny" or "restricted".');
    }
    network.policy = value.policy;
  }
  if (value.maxRequestBytes !== undefined) {
    network.maxRequestBytes = validateNonNegativeNumber(value.maxRequestBytes, 'network.maxRequestBytes');
  }
  if (value.maxResponseBytes !== undefined) {
    network.maxResponseBytes = validateNonNegativeNumber(value.maxResponseBytes, 'network.maxResponseBytes');
  }
  if (value.timeoutMs !== undefined) {
    network.timeoutMs = validateNonNegativeNumber(value.timeoutMs, 'network.timeoutMs');
  }

  return network;
}

function validateLimits(value: unknown): SandboxPolicyLimits {
  if (!isRecord(value)) {
    throw new Error('Sandbox policy limits must be an object.');
  }

  const knownLimitFields = new Set<string>(LIMIT_FIELDS);
  for (const key of Object.keys(value)) {
    if (!knownLimitFields.has(key)) {
      throw new Error(`Sandbox policy limits has an unknown key "${key}".`);
    }
  }

  const limits: SandboxPolicyLimits = {};
  for (const field of LIMIT_FIELDS) {
    const raw = value[field];
    if (raw !== undefined) {
      limits[field] = validateNonNegativeNumber(raw, `limits.${field}`);
    }
  }

  return limits;
}

function validateStorage(value: unknown): SandboxStorage {
  if (value !== 'none' && value !== 'skill-local') {
    throw new Error('Sandbox policy storage must be "none" or "skill-local".');
  }
  return value;
}

function validateEnforcement(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Sandbox policy enforcement must be an object.');
  }
  return value;
}

function validatePolicy(parsed: unknown): SandboxPolicy {
  if (!isRecord(parsed)) {
    throw new Error('Sandbox policy must be an object.');
  }

  for (const key of Object.keys(parsed)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`Sandbox policy has an unknown key "${key}".`);
    }
  }

  const policy: SandboxPolicy = {};

  if (parsed.network !== undefined) {
    policy.network = validateNetwork(parsed.network);
  }
  if (parsed.limits !== undefined) {
    policy.limits = validateLimits(parsed.limits);
  }
  if (parsed.storage !== undefined) {
    policy.storage = validateStorage(parsed.storage);
  }
  if (parsed.dom !== undefined) {
    if (parsed.dom !== false) {
      throw new Error('Sandbox policy dom must be false when present.');
    }
    policy.dom = false;
  }
  if (parsed.enforcement !== undefined) {
    policy.enforcement = validateEnforcement(parsed.enforcement);
  }

  return policy;
}

/**
 * Parse and strictly validate an OpenShell-style sandbox policy document.
 *
 * Mirrors the validate-and-throw style of `parseSkillManifest`
 * (`lib/agent-sandbox/src/skillManifest.ts`): each field is checked and a clear
 * `Error` is thrown on bad input. Unknown top-level keys are rejected.
 */
export function parseSandboxPolicy(input: string, options: ParseSandboxPolicyOptions = {}): SandboxPolicy {
  const format = options.format ?? 'auto';
  return validatePolicy(parseDocument(input, format));
}
