import { describe, expect, it } from 'vitest';

import { createArtifact } from './artifacts';
import {
  AGENT_CANVAS_KIND_PREFIX,
  buildAgentCanvasPromptContext,
  createAgentCanvasArtifact,
  createStarterAgentCanvases,
  getAgentCanvasRevision,
  isAgentCanvasArtifact,
  listAgentCanvasSummaries,
  updateAgentCanvasArtifactSafely,
} from './agentCanvases';

const now = '2026-05-07T03:50:00.000Z';

describe('agentCanvases', () => {
  it('creates typed canvas artifacts for the supported durable artifact kinds', () => {
    const canvases = createStarterAgentCanvases({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sourceSessionId: 'session-1',
      now: () => now,
    });

    expect(canvases.map((canvas) => canvas.kind)).toEqual([
      `${AGENT_CANVAS_KIND_PREFIX}dashboard`,
      `${AGENT_CANVAS_KIND_PREFIX}diagram`,
      `${AGENT_CANVAS_KIND_PREFIX}checklist`,
      `${AGENT_CANVAS_KIND_PREFIX}review-panel`,
    ]);
    expect(canvases.map((canvas) => canvas.id)).toEqual([
      'canvas-ws-research-dashboard',
      'canvas-ws-research-diagram',
      'canvas-ws-research-checklist',
      'canvas-ws-research-review-panel',
    ]);
    expect(canvases.every(isAgentCanvasArtifact)).toBe(true);
    expect(canvases[0].files.map((file) => file.path)).toEqual(['dashboard.md']);
    expect(canvases[0].sourceSessionId).toBe('session-1');
  });

  it('lists canvas summaries with kind, revision, primary file, and newest-first ordering', () => {
    const older = createAgentCanvasArtifact({
      id: 'canvas-plan',
      title: 'Planning dashboard',
      canvasKind: 'dashboard',
      files: [{ path: 'dashboard.md', content: '# Plan' }],
    }, { now: () => '2026-05-07T03:00:00.000Z' });
    const newer = createAgentCanvasArtifact({
      id: 'canvas-review',
      title: 'Review panel',
      canvasKind: 'review-panel',
      files: [{ path: 'review.md', content: '# Review' }],
    }, { now: () => '2026-05-07T03:05:00.000Z' });
    const updated = updateAgentCanvasArtifactSafely(newer, {
      expectedRevision: 1,
      files: [{ path: 'review.md', content: '# Review\n\n- [x] First pass' }],
    }, {
      now: () => '2026-05-07T03:10:00.000Z',
      idFactory: () => 'revision-1',
    });
    const regularArtifact = createArtifact({
      id: 'artifact-notes',
      title: 'Notes',
      files: [{ path: 'notes.md', content: '# Notes' }],
    }, { now: () => '2026-05-07T03:15:00.000Z' });

    const summaries = listAgentCanvasSummaries([older, updated, regularArtifact]);

    expect(summaries).toEqual([
      expect.objectContaining({
        id: 'canvas-review',
        title: 'Review panel',
        canvasKind: 'review-panel',
        revision: 2,
        primaryFilePath: 'review.md',
        fileCount: 1,
      }),
      expect.objectContaining({
        id: 'canvas-plan',
        title: 'Planning dashboard',
        canvasKind: 'dashboard',
        revision: 1,
        primaryFilePath: 'dashboard.md',
      }),
    ]);
    expect(getAgentCanvasRevision(updated)).toBe(2);
  });

  it('builds agent prompt context with explicit IDs, revision numbers, and safe update guidance', () => {
    const canvas = updateAgentCanvasArtifactSafely(createAgentCanvasArtifact({
      id: 'canvas-launch',
      title: 'Launch checklist',
      canvasKind: 'checklist',
      files: [{ path: 'checklist.md', content: '- [ ] Verify release' }],
    }, { now: () => '2026-05-07T03:00:00.000Z' }), {
      expectedRevision: 1,
      files: [{ path: 'checklist.md', content: '- [x] Verify release' }],
    }, {
      now: () => '2026-05-07T03:10:00.000Z',
      idFactory: () => 'revision-1',
    });

    const context = buildAgentCanvasPromptContext([canvas]);

    expect(context).toContain('Durable agent canvases are mounted as artifacts');
    expect(context).toContain('Canvas: Launch checklist (canvas-launch)');
    expect(context).toContain('Kind: checklist');
    expect(context).toContain('Revision: 2');
    expect(context).toContain('//artifacts/canvas-launch/checklist.md');
    expect(context).toContain('expected revision');
  });

  it('rejects stale follow-up updates and non-canvas artifacts', () => {
    const canvas = createAgentCanvasArtifact({
      id: 'canvas-diagram',
      title: 'Runtime diagram',
      canvasKind: 'diagram',
      files: [{ path: 'diagram.md', content: 'graph TD; A-->B;' }],
    }, { now: () => now });
    const regularArtifact = createArtifact({
      id: 'artifact-notes',
      title: 'Notes',
      files: [{ path: 'notes.md', content: '# Notes' }],
    }, { now: () => now });

    expect(() => updateAgentCanvasArtifactSafely(canvas, {
      expectedRevision: 2,
      files: [{ path: 'diagram.md', content: 'graph TD; A-->C;' }],
    })).toThrow('Canvas revision mismatch');
    expect(() => updateAgentCanvasArtifactSafely(regularArtifact, {
      expectedRevision: 1,
      files: [{ path: 'notes.md', content: '# Updated' }],
    })).toThrow('Agent canvas updates require an agent-canvas artifact');
  });
});
