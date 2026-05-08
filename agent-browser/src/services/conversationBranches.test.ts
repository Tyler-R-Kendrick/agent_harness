import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONVERSATION_BRANCHING_STATE,
  buildConversationBranchProcessEntries,
  buildConversationBranchPromptContext,
  commitConversationSubthread,
  createConversationBranchingState,
  isConversationBranchingState,
  mergeConversationSubthread,
  summarizeConversationBranches,
} from './conversationBranches';

describe('conversationBranches', () => {
  it('creates a durable branch state with a main commit and stable subthread id', () => {
    const state = createConversationBranchingState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      request: 'Branch this conversation to investigate auth options',
      now: new Date('2026-05-08T01:00:00.000Z'),
    });

    expect(state).toMatchObject({
      enabled: true,
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      mainBranchId: 'main',
      createdAt: '2026-05-08T01:00:00.000Z',
    });
    expect(state.subthreads).toHaveLength(1);
    expect(state.subthreads[0]).toMatchObject({
      id: 'subthread:ws-research:branch-this-conversation-to-investigate-auth-options',
      branchName: 'conversation/research/branch-this-conversation-to-investigate-auth-options',
      status: 'running',
      summary: 'Branch started: Branch this conversation to investigate auth options',
    });
    expect(Object.values(state.commits).map((commit) => commit.branchId)).toEqual([
      'main',
      state.subthreads[0].id,
    ]);
  });

  it('appends subthread commits without changing the subthread id', () => {
    const initial = createConversationBranchingState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      request: 'Branch auth options',
      now: new Date('2026-05-08T01:00:00.000Z'),
    });
    const subthreadId = initial.subthreads[0].id;

    const next = commitConversationSubthread(initial, subthreadId, {
      sourceSessionId: 'session-branch',
      messageIds: ['m1', 'm2'],
      summary: 'Compared OAuth and device-code flows.',
      now: new Date('2026-05-08T01:05:00.000Z'),
    });

    expect(next.subthreads).toHaveLength(1);
    expect(next.subthreads[0].id).toBe(subthreadId);
    expect(next.subthreads[0]).toMatchObject({
      headCommitId: expect.stringContaining('subthread-ws-research-branch-auth-options'),
      summary: 'Compared OAuth and device-code flows.',
      status: 'running',
    });
    expect(Object.values(next.commits)).toHaveLength(3);
    expect(next.commits[next.subthreads[0].headCommitId]).toMatchObject({
      parentIds: [initial.subthreads[0].headCommitId],
      messageIds: ['m1', 'm2'],
      sourceSessionId: 'session-branch',
    });
  });

  it('merges the latest subthread commit back into the main branch context', () => {
    const initial = createConversationBranchingState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      request: 'Branch auth options',
      now: new Date('2026-05-08T01:00:00.000Z'),
    });
    const updated = commitConversationSubthread(initial, initial.subthreads[0].id, {
      sourceSessionId: 'session-branch',
      messageIds: ['m2'],
      summary: 'Use device-code auth for local shells.',
      now: new Date('2026-05-08T01:05:00.000Z'),
    });

    const merged = mergeConversationSubthread(updated, updated.subthreads[0].id, {
      summary: 'Merged auth branch into main: prefer device-code auth.',
      now: new Date('2026-05-08T01:08:00.000Z'),
    });

    const subthread = merged.subthreads[0];
    const mergeCommit = merged.commits[merged.mainHeadCommitId];
    expect(subthread.status).toBe('merged');
    expect(subthread.lastMergedCommitId).toBe(updated.subthreads[0].headCommitId);
    expect(mergeCommit.branchId).toBe('main');
    expect(mergeCommit.parentIds).toEqual([updated.mainHeadCommitId, updated.subthreads[0].headCommitId]);
    expect(mergeCommit.summary).toBe('Merged auth branch into main: prefer device-code auth.');
  });

  it('builds prompt context from active and merged branch summaries', () => {
    const state = mergeConversationSubthread(
      createConversationBranchingState({
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        mainSessionId: 'session-main',
        request: 'Branch auth options',
        now: new Date('2026-05-08T01:00:00.000Z'),
      }),
      'subthread:ws-research:branch-auth-options',
      {
        summary: 'Merged auth branch into main.',
        now: new Date('2026-05-08T01:08:00.000Z'),
      },
    );

    const context = buildConversationBranchPromptContext(state);

    expect(context).toContain('## Conversation Branches');
    expect(context).toContain('Main session: session-main');
    expect(context).toContain('conversation/research/branch-auth-options');
    expect(context).toContain('Status: merged');
    expect(context).toContain('Latest summary: Branch started: Branch auth options');
    expect(buildConversationBranchPromptContext(DEFAULT_CONVERSATION_BRANCHING_STATE)).toBe('');
    expect(buildConversationBranchPromptContext({
      ...state,
      settings: { ...state.settings, includeBranchContext: false },
    })).toBe('');
  });

  it('projects commits into ProcessGraph-compatible branch rows', () => {
    const state = mergeConversationSubthread(
      createConversationBranchingState({
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        mainSessionId: 'session-main',
        request: 'Branch auth options',
        now: new Date('2026-05-08T01:00:00.000Z'),
      }),
      'subthread:ws-research:branch-auth-options',
      {
        summary: 'Merged auth branch into main.',
        now: new Date('2026-05-08T01:08:00.000Z'),
      },
    );

    const entries = buildConversationBranchProcessEntries(state);

    expect(entries.map((entry) => entry.kind)).toEqual(['commit', 'commit', 'commit']);
    expect(entries.map((entry) => entry.branchId)).toEqual([
      'main',
      'subthread:ws-research:branch-auth-options',
      'main',
    ]);
    expect(entries.at(-1)).toMatchObject({
      actor: 'conversation-branch',
      summary: 'Merged auth branch into main.',
      status: 'done',
    });
  });

  it('summarizes branch state and validates persisted shape', () => {
    const state = createConversationBranchingState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      request: 'Branch auth options',
    });

    expect(summarizeConversationBranches(state)).toMatchObject({
      totalSubthreads: 1,
      activeSubthreads: 1,
      mergedSubthreads: 0,
      commitCount: 2,
      latestSummary: 'Branch started: Branch auth options',
    });
    expect(isConversationBranchingState(state)).toBe(true);
    expect(isConversationBranchingState({ ...state, enabled: 'yes' })).toBe(false);
    expect(isConversationBranchingState({
      ...state,
      subthreads: [{ ...state.subthreads[0], status: 'unknown' }],
    })).toBe(false);
    expect(isConversationBranchingState({
      ...state,
      commits: { bad: { ...Object.values(state.commits)[0], parentIds: [42] } },
    })).toBe(false);
  });
});
