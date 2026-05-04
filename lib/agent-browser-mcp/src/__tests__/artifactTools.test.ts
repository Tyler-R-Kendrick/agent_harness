import { describe, expect, it, vi } from 'vitest';
import { getModelContextRegistry, ModelContext } from '@agent-harness/webmcp';

import { createWebMcpTool } from '../tool';
import { registerArtifactTools } from '../artifactTools';

describe('registerArtifactTools', () => {
  it('lists and reads mounted workspace artifacts', async () => {
    const modelContext = new ModelContext();
    registerArtifactTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      artifacts: [{
        id: 'artifact-dashboard',
        title: 'Dashboard',
        kind: 'html',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        files: [{ path: 'index.html', content: '<h1>Ok</h1>', mediaType: 'text/html' }],
        references: ['artifact-styleguide'],
        versions: [{}],
      }, {
        id: 'artifact-note',
        title: 'Note',
        description: 'Reference note',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        files: [{ path: 'README.md', content: '# Note' }],
        references: [],
      }],
    });
    const tool = createWebMcpTool(modelContext);

    await expect(tool.execute({ tool: 'list_artifacts', args: {} })).resolves.toEqual([expect.objectContaining({
      id: 'artifact-dashboard',
      fileCount: 1,
      references: ['artifact-styleguide'],
      versionCount: 1,
    }), expect.objectContaining({
      id: 'artifact-note',
      description: 'Reference note',
      kind: null,
      versionCount: 0,
    })]);
    await expect(tool.execute({ tool: 'read_artifact', args: { artifactId: 'artifact-dashboard' } })).resolves.toMatchObject({
      id: 'artifact-dashboard',
      files: [{ path: 'index.html', content: '<h1>Ok</h1>', mediaType: 'text/html' }],
    });
    await expect(tool.execute({ tool: 'read_artifact', args: { artifactId: 'artifact-missing' } }))
      .rejects
      .toThrow('Artifact "artifact-missing" is not available');
  });

  it('creates and updates artifacts through workspace callbacks', async () => {
    const modelContext = new ModelContext();
    const createArtifact = vi.fn(async (input) => ({
      id: input.id ?? 'artifact-created',
      title: input.title ?? 'Created',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
      files: input.files,
      references: input.references,
    }));
    const updateArtifact = vi.fn(async (artifactId, input) => ({
      id: artifactId,
      title: input.title ?? 'Updated',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:01:00.000Z',
      files: input.files,
      references: input.references,
    }));
    registerArtifactTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onCreateArtifact: createArtifact,
      onUpdateArtifact: updateArtifact,
    });
    const tool = createWebMcpTool(modelContext);

    await expect(tool.execute({
      tool: 'create_artifact',
      args: {
        id: 'artifact-created',
        title: 'Created',
        description: 'Interactive dashboard',
        kind: 'typescript',
        sourceSessionId: 'session-1',
        references: ['artifact-parent'],
        files: [{
          path: 'src/index.ts',
          content: 'export {}',
          mediaType: 'text/typescript',
          updatedAt: '2026-05-03T00:00:00.000Z',
        }],
      },
    })).resolves.toMatchObject({ id: 'artifact-created', references: ['artifact-parent'] });
    expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
      id: 'artifact-created',
      title: 'Created',
      description: 'Interactive dashboard',
      kind: 'typescript',
      sourceSessionId: 'session-1',
      files: [{
        path: 'src/index.ts',
        content: 'export {}',
        mediaType: 'text/typescript',
        updatedAt: '2026-05-03T00:00:00.000Z',
      }],
    }));

    await expect(tool.execute({
      tool: 'update_artifact',
      args: {
        artifactId: 'artifact-created',
        files: [{ path: 'src/index.ts', content: 'export const ok = true;' }],
      },
    })).resolves.toMatchObject({ id: 'artifact-created', title: 'Updated' });
    expect(updateArtifact).toHaveBeenCalledWith('artifact-created', expect.objectContaining({
      files: [{ path: 'src/index.ts', content: 'export const ok = true;' }],
    }));
  });

  it('rejects malformed artifact tool inputs', async () => {
    const modelContext = new ModelContext();
    registerArtifactTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onCreateArtifact: async (input) => ({
        id: input.id ?? 'artifact-created',
        title: input.title ?? 'Created',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        files: input.files,
        references: input.references,
      }),
    });
    const tool = createWebMcpTool(modelContext);

    await expect(tool.execute({ tool: 'read_artifact', args: {} })).rejects.toThrow('Artifact id is required');
    await expect(tool.execute({ tool: 'create_artifact', args: { files: [] } })).rejects.toThrow('Artifacts need at least one file');
    await expect(tool.execute({ tool: 'create_artifact', args: { files: [null] } })).rejects.toThrow('Artifact files need path and content');
    await expect(tool.execute({ tool: 'create_artifact', args: { files: [{ path: 'README.md' }] } })).rejects.toThrow('Artifact files need path and content');
  });

  it('does not register artifact tools when the workspace has no artifact surface', () => {
    const modelContext = new ModelContext();
    registerArtifactTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });
    expect(getModelContextRegistry(modelContext).list()).toEqual([]);
  });
});
