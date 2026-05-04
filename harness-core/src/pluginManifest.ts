import { z } from 'zod';

import { hookPointForEvent, type HarnessHookEventDescriptor } from './hooks.js';

export const HARNESS_PLUGIN_MANIFEST_FILENAME = 'agent-harness.plugin.json';
export const HARNESS_PLUGIN_MARKETPLACE_MANIFEST_FILENAME = 'agent-harness.marketplace.json';
export const HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION = 1;

export type HarnessPluginCapabilityKind =
  | 'tool'
  | 'command'
  | 'hook'
  | 'memory'
  | 'artifact'
  | 'setting'
  | 'model-provider'
  | 'chat-agent'
  | 'asset'
  | 'event';

export interface HarnessPluginManifest {
  schemaVersion: typeof HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: {
    module: string;
    export?: string;
  };
  capabilities?: Array<{
    kind: HarnessPluginCapabilityKind;
    id: string;
    event?: HarnessHookEventDescriptor;
    description?: string;
  }>;
  events?: Array<HarnessHookEventDescriptor & { description?: string }>;
  assets?: Array<{
    kind: 'example' | 'runtime' | 'documentation' | 'fixture';
    path: string;
    description?: string;
  }>;
  permissions?: Array<{
    scope: 'workspace-files' | 'filesystem' | 'network' | 'secrets' | 'browser' | 'shell' | 'storage';
    access: 'read' | 'write' | 'execute' | 'read-write';
    reason: string;
  }>;
  compatibility?: {
    harnessCore?: string;
    agentBrowser?: string;
  };
}

export interface HarnessPluginMarketplaceManifest {
  schemaVersion: typeof HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION;
  name: string;
  publisher: {
    id: string;
    name: string;
  };
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    manifest: string;
    source: {
      type: 'local' | 'git' | 'npm' | 'url';
      path?: string;
      url?: string;
      package?: string;
      ref?: string;
    };
    categories?: string[];
    keywords?: string[];
    default?: boolean;
  }>;
}

export interface HarnessManifestValidationResult {
  success: boolean;
  issues: string[];
}

const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){2,}$/;
const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const EXPORT_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RELATIVE_PACKAGE_PATH_PATTERN = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$)).+/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const CAPABILITY_KINDS = new Set<HarnessPluginCapabilityKind>([
  'tool',
  'command',
  'hook',
  'memory',
  'artifact',
  'setting',
  'model-provider',
  'chat-agent',
  'asset',
  'event',
]);

const hookEventSchema = z.object({
  type: z.enum(['llm', 'agent', 'harness', 'system', 'plugin']),
  name: z.string().regex(EVENT_NAME_PATTERN, 'Hook event names must be lowercase dot- or kebab-case.'),
});

const capabilitySchema = z.object({
  kind: z.string(),
  id: z.string().regex(EVENT_NAME_PATTERN, 'Capability ids must be lowercase dot- or kebab-case.'),
  event: hookEventSchema.optional(),
  description: z.string().optional(),
}).superRefine((value, context) => {
  if (!CAPABILITY_KINDS.has(value.kind as HarnessPluginCapabilityKind)) {
    context.addIssue({
      code: 'custom',
      path: ['kind'],
      message: `Capability kind "${value.kind}" is not part of the core plugin standard.`,
    });
  }
});

const pluginManifestSchema = z.object({
  schemaVersion: z.literal(HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION),
  id: z.string().regex(PLUGIN_ID_PATTERN, 'Plugin id must use reverse-DNS lowercase segments.'),
  name: z.string().min(1, 'Plugin name is required.'),
  version: z.string().regex(SEMVER_PATTERN, 'Plugin version must be a semver string.'),
  description: z.string().min(1, 'Plugin description is required.'),
  entrypoint: z.object({
    module: z.string().regex(
      RELATIVE_PACKAGE_PATH_PATTERN,
      'Entrypoint module must be a relative path inside the plugin package.',
    ),
    export: z.string().regex(EXPORT_NAME_PATTERN, 'Entrypoint export must be a JavaScript export name.').optional(),
  }),
  capabilities: z.array(capabilitySchema).optional(),
  events: z.array(hookEventSchema.extend({ description: z.string().optional() })).optional(),
  assets: z.array(z.object({
    kind: z.enum(['example', 'runtime', 'documentation', 'fixture']),
    path: z.string().regex(RELATIVE_PACKAGE_PATH_PATTERN, 'Asset paths must stay inside the plugin package.'),
    description: z.string().optional(),
  })).optional(),
  permissions: z.array(z.object({
    scope: z.enum(['workspace-files', 'filesystem', 'network', 'secrets', 'browser', 'shell', 'storage']),
    access: z.enum(['read', 'write', 'execute', 'read-write']),
    reason: z.string().min(1, 'Permission reason is required.'),
  })).optional(),
  compatibility: z.object({
    harnessCore: z.string().optional(),
    agentBrowser: z.string().optional(),
  }).optional(),
});

const marketplaceManifestSchema = z.object({
  schemaVersion: z.literal(HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION),
  name: z.string().min(1, 'Marketplace name is required.'),
  publisher: z.object({
    id: z.string().regex(EVENT_NAME_PATTERN, 'Publisher id must be lowercase dot- or kebab-case.'),
    name: z.string().min(1, 'Publisher name is required.'),
  }),
  plugins: z.array(z.object({
    id: z.string().regex(PLUGIN_ID_PATTERN, 'Plugin id must use reverse-DNS lowercase segments.'),
    name: z.string().min(1, 'Plugin name is required.'),
    version: z.string().regex(SEMVER_PATTERN, 'Plugin version must be a semver string.'),
    description: z.string().min(1, 'Plugin description is required.'),
    manifest: z.string().endsWith(
      HARNESS_PLUGIN_MANIFEST_FILENAME,
      `Marketplace plugin entries must reference ${HARNESS_PLUGIN_MANIFEST_FILENAME} manifests.`,
    ),
    source: z.object({
      type: z.enum(['local', 'git', 'npm', 'url']),
      path: z.string().optional(),
      url: z.string().optional(),
      package: z.string().optional(),
      ref: z.string().optional(),
    }),
    categories: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    default: z.boolean().optional(),
  })),
});

export function validateHarnessPluginManifest(value: unknown): HarnessManifestValidationResult {
  const result = pluginManifestSchema.safeParse(value);
  return result.success
    ? { success: true, issues: [] }
    : { success: false, issues: result.error.issues.map((issue) => issue.message) };
}

export function parseHarnessPluginManifest(value: unknown): HarnessPluginManifest {
  const result = validateHarnessPluginManifest(value);
  if (!result.success) {
    throw new Error(`Invalid harness plugin manifest: ${result.issues.join('; ')}`);
  }
  return value as HarnessPluginManifest;
}

export function validateHarnessPluginMarketplaceManifest(value: unknown): HarnessManifestValidationResult {
  const result = marketplaceManifestSchema.safeParse(value);
  return result.success
    ? { success: true, issues: [] }
    : { success: false, issues: result.error.issues.map((issue) => issue.message) };
}

export function parseHarnessPluginMarketplaceManifest(value: unknown): HarnessPluginMarketplaceManifest {
  const result = validateHarnessPluginMarketplaceManifest(value);
  if (!result.success) {
    throw new Error(`Invalid harness plugin marketplace manifest: ${result.issues.join('; ')}`);
  }
  return value as HarnessPluginMarketplaceManifest;
}

export function createPluginHookEvent(pluginId: string, eventName: string): HarnessHookEventDescriptor {
  assertPluginId(pluginId);
  if (!EVENT_NAME_PATTERN.test(eventName)) {
    throw new Error('Plugin hook event names must be lowercase dot- or kebab-case.');
  }
  return {
    type: 'plugin',
    name: `${pluginId}.${eventName}`,
  };
}

export function createPluginHookPoint(pluginId: string, eventName: string): string {
  return hookPointForEvent(createPluginHookEvent(pluginId, eventName));
}

function assertPluginId(pluginId: string): void {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error('Plugin id must use reverse-DNS lowercase segments.');
  }
}
