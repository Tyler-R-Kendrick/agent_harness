import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpArtifact,
  WorkspaceMcpArtifactFile,
  WorkspaceMcpWriteArtifactInput,
} from './workspaceToolTypes';

interface ArtifactIdInput {
  artifactId?: string;
  artifact_id?: string;
  id?: string;
}

interface RawArtifactInput extends ArtifactIdInput {
  title?: string;
  description?: string;
  kind?: string;
  sourceSessionId?: string;
  references?: unknown;
  files?: unknown;
}

export function registerArtifactTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    artifacts = [],
    onCreateArtifact,
    onUpdateArtifact,
    signal,
  } = options;

  const hasArtifactTools = artifacts.length > 0 || onCreateArtifact || onUpdateArtifact;
  if (!hasArtifactTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_artifacts',
    title: 'List artifacts',
    description: 'List standalone artifacts mounted in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => artifacts.map(toArtifactSummary),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_artifact',
    title: 'Read artifact',
    description: 'Read a standalone artifact by id, including its files and references.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string' },
        artifact_id: { type: 'string' },
        id: { type: 'string' },
      },
      anyOf: [{ required: ['artifactId'] }, { required: ['artifact_id'] }, { required: ['id'] }],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const artifactId = readArtifactId(input as ArtifactIdInput);
      return readArtifact(artifacts, artifactId);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onCreateArtifact) {
    modelContext.registerTool({
      name: 'create_artifact',
      title: 'Create artifact',
      description: 'Create a standalone artifact with one or more files mounted under //artifacts.',
      inputSchema: artifactWriteSchema(false),
      execute: async (input: object) => onCreateArtifact(toArtifactInput(input as RawArtifactInput)),
    }, { signal });
  }

  if (onUpdateArtifact) {
    modelContext.registerTool({
      name: 'update_artifact',
      title: 'Update artifact',
      description: 'Update a standalone artifact and preserve the prior content as artifact version history.',
      inputSchema: artifactWriteSchema(true),
      execute: async (input: object) => {
        const artifactId = readArtifactId(input as ArtifactIdInput);
        return onUpdateArtifact(artifactId, toArtifactInput(input as RawArtifactInput));
      },
    }, { signal });
  }
}

function artifactWriteSchema(requiresArtifactId: boolean) {
  const schema: Record<string, unknown> = {
    type: 'object',
    properties: {
      artifactId: { type: 'string' },
      artifact_id: { type: 'string' },
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      kind: { type: 'string' },
      sourceSessionId: { type: 'string' },
      references: { type: 'array', items: { type: 'string' } },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            mediaType: { type: 'string' },
            updatedAt: { type: 'string' },
          },
          required: ['path', 'content'],
          additionalProperties: false,
        },
      },
    },
    required: ['files'],
    additionalProperties: false,
  };
  if (requiresArtifactId) {
    schema.anyOf = [{ required: ['artifactId'] }, { required: ['artifact_id'] }, { required: ['id'] }];
  }
  return schema;
}

function readArtifact(artifacts: readonly WorkspaceMcpArtifact[], artifactId: string): WorkspaceMcpArtifact {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact) {
    throw new DOMException(`Artifact "${artifactId}" is not available.`, 'NotFoundError');
  }
  return artifact;
}

function readArtifactId(input: ArtifactIdInput): string {
  const id = (input.artifactId ?? input.artifact_id ?? input.id ?? '').trim();
  if (!id) {
    throw new TypeError('Artifact id is required.');
  }
  return id;
}

function toArtifactInput(input: RawArtifactInput): WorkspaceMcpWriteArtifactInput {
  return {
    ...(typeof input.id === 'string' && input.id.trim() ? { id: input.id.trim() } : {}),
    ...(typeof input.artifactId === 'string' && input.artifactId.trim() ? { id: input.artifactId.trim() } : {}),
    ...(typeof input.artifact_id === 'string' && input.artifact_id.trim() ? { id: input.artifact_id.trim() } : {}),
    ...(typeof input.title === 'string' && input.title.trim() ? { title: input.title.trim() } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.kind === 'string' && input.kind.trim() ? { kind: input.kind.trim() } : {}),
    ...(typeof input.sourceSessionId === 'string' && input.sourceSessionId.trim() ? { sourceSessionId: input.sourceSessionId.trim() } : {}),
    references: normalizeReferences(input.references),
    files: normalizeFiles(input.files),
  };
}

function normalizeReferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeFiles(value: unknown): WorkspaceMcpArtifactFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Artifacts need at least one file.');
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('Artifact files need path and content strings.');
    }
    const file = entry as Partial<WorkspaceMcpArtifactFile>;
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new TypeError('Artifact files need path and content strings.');
    }
    return {
      path: file.path,
      content: file.content,
      ...(typeof file.mediaType === 'string' ? { mediaType: file.mediaType } : {}),
      ...(typeof file.updatedAt === 'string' ? { updatedAt: file.updatedAt } : {}),
    };
  });
}

function toArtifactSummary(artifact: WorkspaceMcpArtifact) {
  return {
    id: artifact.id,
    title: artifact.title,
    kind: artifact.kind ?? null,
    description: artifact.description ?? null,
    fileCount: artifact.files.length,
    references: [...artifact.references],
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    versionCount: artifact.versions?.length ?? 0,
  };
}
