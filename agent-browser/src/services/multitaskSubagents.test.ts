import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MULTITASK_SUBAGENT_STATE,
  buildMultitaskPromptContext,
  createMultitaskSubagentState,
  isMultitaskSubagentState,
  promoteMultitaskBranch,
  summarizeMultitaskSubagents,
} from './multitaskSubagents';

describe('multitaskSubagents', () => {
  it('creates deterministic isolated subagent branches from a larger request', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });

    expect(state).toMatchObject({
      enabled: true,
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      createdAt: '2026-05-07T10:00:00.000Z',
      foregroundBranchId: null,
    });
    expect(state.branches.map((branch) => branch.branchName)).toEqual([
      'agent/research/frontend-1',
      'agent/research/tests-2',
      'agent/research/documentation-3',
    ]);
    expect(state.branches.map((branch) => branch.worktreePath)).toEqual([
      '.worktrees/agent/research/frontend-1',
      '.worktrees/agent/research/tests-2',
      '.worktrees/agent/research/documentation-3',
    ]);
    expect(state.branches[0]).toMatchObject({
      status: 'running',
      progress: 35,
      role: 'Frontend specialist',
    });
    expect(state.branches.slice(1).every((branch) => branch.status === 'queued')).toBe(true);
  });

  it('summarizes comparison state and promotes one branch to the foreground', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-build',
      workspaceName: 'Build Lab',
      request: 'split the app shell, tests, documentation, and release notes across subagents',
      now: new Date('2026-05-07T11:00:00.000Z'),
    });
    const ready = {
      ...initial,
      branches: initial.branches.map((branch) => ({
        ...branch,
        status: 'ready' as const,
        progress: 100,
      })),
    };

    const promoted = promoteMultitaskBranch(ready, ready.branches[2].id);
    const summary = summarizeMultitaskSubagents(promoted);

    expect(promoted.foregroundBranchId).toBe(ready.branches[2].id);
    expect(promoted.branches[2].status).toBe('promoted');
    expect(promoted.branches.filter((branch) => branch.status === 'ready')).toHaveLength(3);
    expect(summary).toMatchObject({
      total: 4,
      ready: 3,
      running: 0,
      blocked: 0,
      changedFiles: expect.any(Number),
      promotedBranch: promoted.branches[2],
    });
    expect(summary.changedFiles).toBeGreaterThan(0);
  });

  it('renders prompt context for enabled isolated branches only', () => {
    const state = promoteMultitaskBranch(
      createMultitaskSubagentState({
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        request: 'delegate branch-safe API and UI experiments',
        now: new Date('2026-05-07T12:00:00.000Z'),
      }),
      'multitask:ws-research:ui-2',
    );

    const context = buildMultitaskPromptContext(state);

    expect(context).toContain('## Multitask Subagents');
    expect(context).toContain('Branch isolation: enabled');
    expect(context).toContain('Foreground branch: agent/research/ui-2');
    expect(context).toContain('.worktrees/agent/research/api-1');
    expect(context).toContain('Validation:');
    expect(buildMultitaskPromptContext(DEFAULT_MULTITASK_SUBAGENT_STATE)).toBe('');
  });

  it('validates persisted state shape', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize this',
    });

    expect(isMultitaskSubagentState(state)).toBe(true);
    expect(isMultitaskSubagentState({ ...state, enabled: 'yes' })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], status: 'unknown' }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], changedFiles: ['ok.ts', 42] }],
    })).toBe(false);
  });
});
