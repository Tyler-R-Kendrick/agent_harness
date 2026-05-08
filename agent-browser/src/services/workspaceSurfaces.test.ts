import { describe, expect, it } from 'vitest';

import { createArtifact } from './artifacts';
import {
  DEFAULT_WORKSPACE_SURFACE_PERMISSIONS,
  buildWorkspaceSurfacePromptContext,
  createWorkspaceSurface,
  isWorkspaceSurfacesByWorkspace,
  rollbackWorkspaceSurface,
  updateWorkspaceSurface,
} from './workspaceSurfaces';

const artifact = createArtifact({
  id: 'artifact-launch-review',
  title: 'Launch review',
  kind: 'agent-canvas:review-panel',
  files: [{
    path: 'review-panel.md',
    mediaType: 'text/markdown',
    content: '# Launch review\n\n- Risk: rollout timing\n',
  }],
}, {
  now: () => '2026-05-08T05:00:00.000Z',
});

describe('workspaceSurfaces', () => {
  it('creates governed surfaces from artifact files with conservative permissions', () => {
    const surface = createWorkspaceSurface({
      workspaceId: 'ws-research',
      artifact,
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      title: ' Launch review surface ',
      description: 'Agent-authored review panel',
      createdByAgent: 'Researcher',
      ownerSessionId: 'session-1',
    }, {
      now: () => '2026-05-08T05:01:00.000Z',
    });

    expect(surface).toEqual({
      id: 'surface-ws-research-artifact-launch-review-review-panel-md',
      workspaceId: 'ws-research',
      artifactId: 'artifact-launch-review',
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      renderTarget: 'panel',
      title: 'Launch review surface',
      description: 'Agent-authored review panel',
      createdByAgent: 'Researcher',
      ownerSessionId: 'session-1',
      permissions: DEFAULT_WORKSPACE_SURFACE_PERMISSIONS,
      revision: 1,
      status: 'active',
      createdAt: '2026-05-08T05:01:00.000Z',
      updatedAt: '2026-05-08T05:01:00.000Z',
      versions: [],
    });
  });

  it('updates surfaces with expected revisions and stores rollback snapshots', () => {
    const surface = createWorkspaceSurface({
      workspaceId: 'ws-research',
      artifact,
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      title: 'Launch review surface',
      createdByAgent: 'Researcher',
    }, {
      now: () => '2026-05-08T05:01:00.000Z',
    });

    const updated = updateWorkspaceSurface(surface, {
      expectedRevision: 1,
      title: 'Launch release review',
      permissions: { canShare: true },
    }, {
      now: () => '2026-05-08T05:02:00.000Z',
    });

    expect(updated.revision).toBe(2);
    expect(updated.title).toBe('Launch release review');
    expect(updated.permissions).toEqual({ ...DEFAULT_WORKSPACE_SURFACE_PERMISSIONS, canShare: true });
    expect(updated.versions).toHaveLength(1);
    expect(updated.versions[0]).toEqual(expect.objectContaining({
      id: 'surface-ws-research-artifact-launch-review-review-panel-md-revision-1',
      revision: 1,
      title: 'Launch review surface',
    }));
    expect(() => updateWorkspaceSurface(updated, { expectedRevision: 1, title: 'Stale edit' })).toThrow(/revision mismatch/i);
  });

  it('rolls back to prior snapshots only when rollback permission is enabled', () => {
    const surface = createWorkspaceSurface({
      workspaceId: 'ws-research',
      artifact,
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      title: 'Launch review surface',
      createdByAgent: 'Researcher',
    }, {
      now: () => '2026-05-08T05:01:00.000Z',
    });
    const updated = updateWorkspaceSurface(surface, {
      expectedRevision: 1,
      title: 'Launch release review',
    }, {
      now: () => '2026-05-08T05:02:00.000Z',
    });

    const rolledBack = rollbackWorkspaceSurface(updated, updated.versions[0].id, {
      now: () => '2026-05-08T05:03:00.000Z',
    });

    expect(rolledBack.title).toBe('Launch review surface');
    expect(rolledBack.revision).toBe(3);
    expect(rolledBack.status).toBe('active');
    expect(rolledBack.updatedAt).toBe('2026-05-08T05:03:00.000Z');

    const locked = updateWorkspaceSurface(rolledBack, {
      expectedRevision: 3,
      permissions: { canRollback: false },
    });
    expect(() => rollbackWorkspaceSurface(locked, locked.versions[0].id)).toThrow(/rollback permission/i);
  });

  it('builds prompt context with exact ids, paths, permissions, and expected revisions', () => {
    const surface = createWorkspaceSurface({
      workspaceId: 'ws-research',
      artifact,
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      title: 'Launch review surface',
      createdByAgent: 'Researcher',
      ownerSessionId: 'session-1',
    }, {
      now: () => '2026-05-08T05:01:00.000Z',
    });

    const context = buildWorkspaceSurfacePromptContext([surface]);
    expect(context).toContain('Persistent workspace surfaces are governed app outputs linked to artifacts.');
    expect(context).toContain('Surface: Launch review surface (surface-ws-research-artifact-launch-review-review-panel-md)');
    expect(context).toContain('Type: review-panel');
    expect(context).toContain('Render target: panel');
    expect(context).toContain('Artifact: //artifacts/artifact-launch-review/review-panel.md');
    expect(context).toContain('Owner: Researcher / session-1');
    expect(context).toContain('Revision: 1');
    expect(context).toContain('Permissions: read, edit, rollback');
  });

  it('validates per-workspace surface records and rejects unsafe payloads', () => {
    const surface = createWorkspaceSurface({
      workspaceId: 'ws-research',
      artifact,
      artifactFilePath: 'review-panel.md',
      surfaceType: 'review-panel',
      title: 'Launch review surface',
      createdByAgent: 'Researcher',
    });

    expect(isWorkspaceSurfacesByWorkspace({ 'ws-research': [surface] })).toBe(true);
    expect(isWorkspaceSurfacesByWorkspace({ 'ws-research': [{ ...surface, permissions: { canRead: true } }] })).toBe(false);
    expect(isWorkspaceSurfacesByWorkspace({ 'ws-research': [{ ...surface, artifactFilePath: '../escape.md' }] })).toBe(false);
  });
});
