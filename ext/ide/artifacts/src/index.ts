import type {
  Artifact,
  ArtifactBody,
  HarnessPlugin,
} from 'harness-core';

export const ARTIFACT_BUNDLE_MEDIA_TYPE = 'application/vnd.agent-harness.artifact-bundle+json';

export interface ArtifactBundleFile {
  path: string;
  content: string;
  mediaType?: string;
}

export interface ArtifactBundle {
  kind: string;
  references: string[];
  files: ArtifactBundleFile[];
}

export interface ArtifactsPluginOptions {
  now?: () => string;
}

interface CreateArtifactArgs {
  id?: string;
  title?: string;
  kind?: string;
  references?: unknown;
  files?: unknown;
}

interface ReadArtifactArgs {
  id?: string;
}

interface UpdateArtifactArgs extends CreateArtifactArgs {
  artifactId?: string;
}

export function createArtifactsPlugin(options: ArtifactsPluginOptions = {}): HarnessPlugin {
  void options;
  return {
    id: 'artifacts',
    register({ artifacts, tools, commands }) {
      tools.register({
        id: 'artifacts.create',
        label: 'Create artifact',
        description: 'Create a standalone, multi-file artifact bundle.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            kind: { type: 'string' },
            references: { type: 'array', items: { type: 'string' } },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                  mediaType: { type: 'string' },
                },
                required: ['path', 'content'],
                additionalProperties: false,
              },
            },
          },
          required: ['files'],
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as CreateArtifactArgs;
          const bundle = encodeArtifactBundle({
            kind: typeof args.kind === 'string' ? args.kind : 'bundle',
            references: normalizeReferences(args.references),
            files: normalizeFiles(args.files),
          });
          const artifact = await artifacts.create({
            ...(typeof args.id === 'string' && args.id.trim() ? { id: args.id.trim() } : {}),
            ...(typeof args.title === 'string' && args.title.trim() ? { title: args.title.trim() } : {}),
            data: JSON.stringify(bundle),
            mediaType: ARTIFACT_BUNDLE_MEDIA_TYPE,
            metadata: metadataForBundle(bundle),
          });
          return toArtifactBundleResult(artifact, bundle);
        },
      });

      tools.register({
        id: 'artifacts.list',
        label: 'List artifacts',
        description: 'List stored artifacts and bundle summaries.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const results = [];
          for (const artifact of artifacts.list()) {
            const snapshot = await artifacts.read(artifact);
            const bundle = snapshot ? decodeArtifactBody(snapshot) : emptyBundle();
            results.push({
              id: artifact.id,
              title: artifact.title ?? artifact.id,
              mediaType: artifact.mediaType ?? null,
              kind: bundle.kind,
              fileCount: bundle.files.length,
              references: bundle.references,
              versionCount: readArtifactVersions(artifact.metadata).length,
              updatedAt: artifact.updatedAt,
            });
          }
          return results;
        },
      });

      tools.register({
        id: 'artifacts.read',
        label: 'Read artifact',
        description: 'Read a stored artifact bundle.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const id = readArtifactId(rawArgs as ReadArtifactArgs);
          const snapshot = await artifacts.read(id);
          if (!snapshot) throw new Error(`Unknown artifact: ${id}`);
          return toArtifactBundleResult(snapshot.artifact, decodeArtifactBody(snapshot));
        },
      });

      tools.register({
        id: 'artifacts.update',
        label: 'Update artifact',
        description: 'Update a standalone, multi-file artifact bundle.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            artifactId: { type: 'string' },
            title: { type: 'string' },
            kind: { type: 'string' },
            references: { type: 'array', items: { type: 'string' } },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                  mediaType: { type: 'string' },
                },
                required: ['path', 'content'],
                additionalProperties: false,
              },
            },
          },
          required: ['files'],
          anyOf: [{ required: ['id'] }, { required: ['artifactId'] }],
          additionalProperties: false,
        },
        execute: async (rawArgs) => {
          const args = rawArgs as UpdateArtifactArgs;
          const id = readArtifactId(args);
          const previous = await artifacts.read(id);
          if (!previous) throw new Error(`Unknown artifact: ${id}`);
          const previousBundle = decodeArtifactBody(previous);
          const bundle = encodeArtifactBundle({
            kind: typeof args.kind === 'string' ? args.kind : previousBundle.kind,
            references: Array.isArray(args.references) ? normalizeReferences(args.references) : previousBundle.references,
            files: normalizeFiles(args.files),
          });
          const versions = [
            {
              id: `${id}-version-${readArtifactVersions(previous.artifact.metadata).length + 1}`,
              createdAt: previous.artifact.updatedAt,
              bundle: previousBundle,
            },
            ...readArtifactVersions(previous.artifact.metadata),
          ];
          const artifact = await artifacts.write(id, {
            data: JSON.stringify(bundle),
            mediaType: ARTIFACT_BUNDLE_MEDIA_TYPE,
            metadata: metadataForBundle(bundle, versions),
          });
          return toArtifactBundleResult(
            typeof args.title === 'string' && args.title.trim() ? { ...artifact, title: args.title.trim() } : artifact,
            bundle,
          );
        },
      });

      commands.register({
        id: 'artifacts.new',
        usage: '/artifact <name>',
        description: 'Draft a new artifact.',
        pattern: /^\/artifact(?:\s+(?<title>.+))?$/i,
        target: {
          type: 'prompt-template',
          template: (_args, match) => {
            const title = match.groups.title?.trim() || 'Untitled artifact';
            return [
              `Create or update an artifact named "${title}".`,
              'Use one or more files when the output is runnable, inspectable, or downloadable.',
              'Preserve artifact references when this artifact depends on another artifact.',
            ].join('\n');
          },
        },
      });
    },
  };
}

export function encodeArtifactBundle(input: {
  kind?: string;
  references?: readonly string[];
  files: readonly ArtifactBundleFile[];
}): ArtifactBundle {
  const files = normalizeFiles(input.files);
  return {
    kind: input.kind?.trim() || 'bundle',
    references: normalizeReferences(input.references ?? []),
    files,
  };
}

export function decodeArtifactBundle(value: ArtifactBundle | string): ArtifactBundle {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!isRecord(parsed)) throw new Error('Artifact bundle must be an object.');
  return encodeArtifactBundle({
    kind: typeof parsed.kind === 'string' ? parsed.kind : 'bundle',
    references: Array.isArray(parsed.references) ? parsed.references : [],
    files: Array.isArray(parsed.files) ? parsed.files as ArtifactBundleFile[] : [],
  });
}

export function ArtifactRenderer(): null {
  return null;
}

function decodeArtifactBody(body: ArtifactBody): ArtifactBundle {
  if (typeof body.data !== 'string') return emptyBundle();
  return decodeArtifactBundle(body.data);
}

function toArtifactBundleResult(artifact: Artifact, bundle: ArtifactBundle) {
  return {
    id: artifact.id,
    title: artifact.title ?? artifact.id,
    mediaType: artifact.mediaType ?? null,
    kind: bundle.kind,
    references: bundle.references,
    files: bundle.files,
    versionCount: readArtifactVersions(artifact.metadata).length,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

function metadataForBundle(bundle: ArtifactBundle, versions: unknown[] = []): Record<string, unknown> {
  return {
    artifactKind: bundle.kind,
    references: bundle.references,
    fileCount: bundle.files.length,
    versions,
  };
}

function normalizeFiles(value: unknown): ArtifactBundleFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Artifacts need at least one file.');
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.content !== 'string') {
      throw new Error('Artifact files need path and content strings.');
    }
    return {
      path: normalizePath(entry.path),
      content: entry.content,
      ...(typeof entry.mediaType === 'string' ? { mediaType: entry.mediaType } : {}),
    };
  });
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized || normalized.startsWith('//') || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Artifact file paths must be relative paths without parent traversal.');
  }
  return normalized;
}

function normalizeReferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))];
}

function readArtifactId(args: ReadArtifactArgs & { artifactId?: string }): string {
  const id = (args.id ?? args.artifactId)?.trim();
  if (!id) throw new Error('Artifact id is required.');
  return id;
}

function readArtifactVersions(metadata: Record<string, unknown>): unknown[] {
  return Array.isArray(metadata.versions) ? metadata.versions : [];
}

function emptyBundle(): ArtifactBundle {
  return { kind: 'bundle', references: [], files: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
