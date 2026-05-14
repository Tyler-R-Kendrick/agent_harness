import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVERSATION_BRANCHING_STATE, createConversationBranchingState, mergeConversationSubthread } from './conversationBranches';
import type { BrowserAgentRunSdkState } from './browserAgentRunSdk';
import type { RunCheckpointState } from './runCheckpoints';
import type { ScheduledAutomationState } from './scheduledAutomations';
import type { ChapteredSessionState } from './sessionChapters';
import {
  appendWorkspaceFileCrdtDiff,
  createWorkspaceFileCrdtHistory,
} from './workspaceFileCrdtHistory';
import { DEFAULT_WORKSPACE_ACTION_HISTORY_STATE, recordWorkspaceActionTransition } from './workspaceActionHistory';
import { buildWorkspaceHistoryGraph } from './workspaceHistoryGraph';

const chapteredSessions: ChapteredSessionState = {
  enabled: true,
  policy: {
    automaticCompression: true,
    compressAfterMessageCount: 2,
    targetTokenBudget: 1200,
    retainRecentMessageCount: 4,
    preserveEvidenceRefs: true,
    renderCompressedMessages: true,
    contextMode: 'standard',
    toolOutputCache: {
      enabled: true,
      inlineTokenLimit: 800,
      fileTokenThreshold: 2400,
      maxMemoryEntries: 50,
      cacheRoot: '.agent-browser/context-cache',
    },
  },
  sessions: {
    'session-checkout': {
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      updatedAt: '2026-05-09T14:10:00.000Z',
      chapters: [
        {
          id: 'chapter:session-checkout:1',
          sessionId: 'session-checkout',
          workspaceId: 'ws-research',
          workspaceName: 'Research',
          title: 'Chapter 1: Fix checkout runtime',
          status: 'compressed',
          startedAt: '2026-05-09T14:00:00.000Z',
          updatedAt: '2026-05-09T14:05:00.000Z',
          messageIds: ['user-1', 'assistant-1', 'tool-1'],
          sourceTraceRefs: ['message:user-1', 'message:assistant-1', 'process:tool-1'],
          evidenceRefs: ['evidence:checkout-before.png'],
          validationRefs: ['validation:checkout-flow'],
          toolOutputRefs: ['tool-output:checkout-log'],
          compressedContext: {
            summary: 'Compressed result covering checkout, runtime, validation.',
            carryForward: ['Checkout validation was preserved.'],
            sourceTraceRefs: ['message:user-1', 'message:assistant-1', 'process:tool-1'],
            evidenceRefs: ['evidence:checkout-before.png'],
            validationRefs: ['validation:checkout-flow'],
            toolOutputRefs: ['tool-output:checkout-log'],
            retainedRecentMessageIds: ['assistant-1', 'tool-1'],
            tokenBudget: 1200,
            estimatedTokens: 24,
            contextMode: 'standard',
            createdAt: '2026-05-09T14:05:00.000Z',
          },
        },
      ],
    },
  },
  toolOutputCache: {},
  audit: [],
};

const runCheckpoints: RunCheckpointState = {
  policy: {
    defaultTimeoutMinutes: 240,
    requireOperatorConfirmation: true,
    preserveArtifacts: true,
  },
  checkpoints: [{
    id: 'checkpoint:session-checkout:2026-05-09T14:08:00.000Z',
    sessionId: 'session-checkout',
    workspaceId: 'ws-research',
    reason: 'approval',
    status: 'suspended',
    summary: 'Approval before deployment',
    boundary: 'before deploy tool call',
    requiredInput: 'operator approval',
    resumeToken: 'resume:session-checkout:2026-05-09T14:08:00.000Z',
    artifacts: ['checkout-before.png'],
    createdAt: '2026-05-09T14:08:00.000Z',
    updatedAt: '2026-05-09T14:08:00.000Z',
    expiresAt: '2026-05-09T18:08:00.000Z',
  }],
  audit: [{
    id: 'audit:checkpoint:session-checkout:2026-05-09T14:08:00.000Z:suspended',
    checkpointId: 'checkpoint:session-checkout:2026-05-09T14:08:00.000Z',
    action: 'suspended',
    actor: 'agent-browser',
    summary: 'Suspended at before deploy tool call',
    createdAt: '2026-05-09T14:08:00.000Z',
  }],
};

const browserAgentRuns: BrowserAgentRunSdkState = {
  runs: [{
    id: 'sdk-launch-smoke',
    title: 'SDK launch smoke',
    sessionId: 'session-checkout',
    workspaceId: 'ws-research',
    prompt: 'Launch a durable browser-agent run through the typed SDK.',
    mode: 'local',
    status: 'running',
    createdAt: '2026-05-09T14:11:00.000Z',
    updatedAt: '2026-05-09T14:11:20.000Z',
    archivedAt: null,
    deletedAt: null,
    eventCursor: 2,
  }],
  events: [{
    id: 'sdk-launch-smoke:1',
    runId: 'sdk-launch-smoke',
    sequence: 1,
    type: 'created',
    createdAt: '2026-05-09T14:11:00.000Z',
    summary: 'Typed SDK created a durable run record.',
  }, {
    id: 'sdk-launch-smoke:2',
    runId: 'sdk-launch-smoke',
    sequence: 2,
    type: 'checkpoint',
    createdAt: '2026-05-09T14:11:20.000Z',
    summary: 'Reconnect cursor 2 is ready for clients.',
  }],
};

const scheduledAutomations: ScheduledAutomationState = {
  automations: [{
    id: 'daily-workspace-audit',
    title: 'Daily workspace audit',
    prompt: 'Run a browser and workspace audit.',
    cadence: 'daily',
    enabled: true,
    nextRunAt: '2026-05-09T15:00:00.000Z',
    retryPolicy: { maxRetries: 1 },
    notificationRoute: 'inbox',
    requiresReviewOn: 'failures',
    createdAt: '2026-05-09T13:55:00.000Z',
    updatedAt: '2026-05-09T13:55:00.000Z',
  }],
  runs: [],
  inbox: [],
};

const workspaceActionHistory = recordWorkspaceActionTransition(
  DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
  {
    workspaceId: 'ws-research',
    workspaceName: 'Research',
    activePanel: 'workspaces',
    activeSessionIds: ['session-checkout'],
    openTabIds: [],
    mountedSessionFsIds: ['session-checkout'],
    sessionIds: ['session-checkout'],
    sessionNamesById: { 'session-checkout': 'Checkout fix' },
    conversationBranchIds: [],
    checkpointIds: [],
    browserAgentRunIds: [],
    scheduledAutomationIds: ['daily-workspace-audit'],
    chapterIds: [],
  },
  {
    workspaceId: 'ws-research',
    workspaceName: 'Research',
    activePanel: 'history',
    activeSessionIds: ['session-checkout'],
    openTabIds: [],
    mountedSessionFsIds: ['session-checkout'],
    sessionIds: ['session-checkout'],
    sessionNamesById: { 'session-checkout': 'Checkout fix' },
    conversationBranchIds: [],
    checkpointIds: ['checkpoint:session-checkout:2026-05-09T14:08:00.000Z'],
    browserAgentRunIds: ['sdk-launch-smoke'],
    scheduledAutomationIds: ['daily-workspace-audit'],
    chapterIds: ['chapter:session-checkout:1'],
  },
  new Date('2026-05-09T14:12:00.000Z'),
);

function createChapteredSessions(
  chapters: Array<{ sessionId: string; sessionName: string; messageId: string; summary: string; updatedAt: string }>,
): ChapteredSessionState {
  return {
    ...chapteredSessions,
    sessions: Object.fromEntries(chapters.map((chapter) => [chapter.sessionId, {
      sessionId: chapter.sessionId,
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      updatedAt: chapter.updatedAt,
      chapters: [{
        id: `chapter:${chapter.sessionId}:1`,
        sessionId: chapter.sessionId,
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        title: `Chapter 1: ${chapter.sessionName}`,
        status: 'compressed' as const,
        startedAt: chapter.updatedAt,
        updatedAt: chapter.updatedAt,
        messageIds: [chapter.messageId],
        sourceTraceRefs: [`message:${chapter.messageId}`],
        evidenceRefs: [],
        validationRefs: [],
        toolOutputRefs: [],
        compressedContext: {
          summary: chapter.summary,
          carryForward: [chapter.summary],
          sourceTraceRefs: [`message:${chapter.messageId}`],
          evidenceRefs: [],
          validationRefs: [],
          toolOutputRefs: [],
          retainedRecentMessageIds: [chapter.messageId],
          tokenBudget: 1200,
          estimatedTokens: 8,
          contextMode: 'standard' as const,
          createdAt: chapter.updatedAt,
        },
      }],
    }])),
    audit: [],
    toolOutputCache: {},
  };
}

function createSeparatedUiActionHistory() {
  const firstSnapshot = { ...workspaceActionHistory.actions[0].beforeSnapshot, activePanel: 'history' };
  const secondSnapshot = { ...firstSnapshot, activePanel: 'models' };
  const withFirst = recordWorkspaceActionTransition(
    DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
    workspaceActionHistory.actions[0].beforeSnapshot,
    firstSnapshot,
    new Date('2026-05-10T10:03:00.000Z'),
  );
  return recordWorkspaceActionTransition(
    withFirst,
    firstSnapshot,
    secondSnapshot,
    new Date('2026-05-10T10:04:00.000Z'),
  );
}

describe('buildWorkspaceHistoryGraph', () => {
  it('projects each session chat chapter as one mainline squash merge with inspectable branch details', () => {
    const graph = buildWorkspaceHistoryGraph({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sessions: [{ id: 'session-checkout', name: 'Checkout fix', isOpen: true }],
      chapterState: chapteredSessions,
      conversationBranchingState: createConversationBranchingState({
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        mainSessionId: 'session-main',
        request: 'Branch auth options',
        now: new Date('2026-05-09T14:15:00.000Z'),
      }),
      runCheckpointState: runCheckpoints,
      browserAgentRunSdkState: browserAgentRuns,
      scheduledAutomationState: scheduledAutomations,
      actionHistoryState: DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      recentActivity: [],
    });

    const sessionRows = graph.rows.filter((row) => row.kind === 'session-squash');

    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]).toMatchObject({
      branchName: 'main',
      title: 'Squash merge: Checkout fix',
      isMainline: true,
      detailCount: 6,
      target: {
        kind: 'chat-session',
        sessionId: 'session-checkout',
        messageIds: ['user-1', 'assistant-1', 'tool-1'],
      },
    });
    expect(sessionRows[0].detailRows.map((row) => row.label)).toEqual([
      'message:user-1',
      'message:assistant-1',
      'process:tool-1',
      'evidence:checkout-before.png',
      'validation:checkout-flow',
      'tool-output:checkout-log',
    ]);
    expect(graph.rows.map((row) => row.title)).not.toContain('message:user-1');
  });

  it('shows merged conversation branches as a mainline squash row while retaining branch commit history', () => {
    const branching = createConversationBranchingState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      mainSessionId: 'session-main',
      subthreadSessionId: 'session-auth-branch',
      request: 'Branch auth options',
      now: new Date('2026-05-09T14:15:00.000Z'),
    });
    const merged = mergeConversationSubthread(branching, branching.subthreads[0].id, {
      summary: 'Merged auth branch into main.',
      now: new Date('2026-05-09T14:30:00.000Z'),
    });

    const graph = buildWorkspaceHistoryGraph({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sessions: [],
      chapterState: { ...chapteredSessions, sessions: {} },
      conversationBranchingState: merged,
      runCheckpointState: { ...runCheckpoints, checkpoints: [], audit: [] },
      browserAgentRunSdkState: { runs: [], events: [] },
      scheduledAutomationState: { automations: [], runs: [], inbox: [] },
      actionHistoryState: DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      recentActivity: [],
    });

    const mergeRow = graph.rows.find((row) => row.kind === 'branch-squash');

    expect(mergeRow).toMatchObject({
      branchName: 'main',
      title: 'Squash merge: Branch auth options',
      isMainline: true,
      target: {
        kind: 'branch-history',
        branchId: 'subthread:ws-research:branch-auth-options',
        sessionId: 'session-auth-branch',
      },
    });
    expect(mergeRow?.detailRows.map((row) => row.label)).toEqual([
      'Main thread before branch: Branch auth options',
      'Branch started: Branch auth options',
    ]);
    expect(graph.summary).toMatchObject({
      mainlineCommits: 1,
      branchCommits: 2,
      squashMerges: 1,
    });
  });

  it('unifies every former History dropdown source into one timeline', () => {
    const fileHistory = appendWorkspaceFileCrdtDiff(
      createWorkspaceFileCrdtHistory({
        workspaceId: 'ws-research',
        path: 'notes.md',
        content: 'before',
        actorId: 'user',
        now: new Date('2026-05-09T14:09:00.000Z'),
      }),
      'before\nafter',
      {
        actorId: 'codex',
        now: new Date('2026-05-09T14:09:30.000Z'),
      },
    );

    const graph = buildWorkspaceHistoryGraph({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sessions: [{ id: 'session-checkout', name: 'Checkout fix', isOpen: true }],
      chapterState: chapteredSessions,
      conversationBranchingState: mergeConversationSubthread(
        createConversationBranchingState({
          workspaceId: 'ws-research',
          workspaceName: 'Research',
          mainSessionId: 'session-main',
          subthreadSessionId: 'session-auth-branch',
          request: 'Branch auth options',
          now: new Date('2026-05-09T14:15:00.000Z'),
        }),
        'subthread:ws-research:branch-auth-options',
        {
          summary: 'Merged auth branch into main.',
          now: new Date('2026-05-09T14:30:00.000Z'),
        },
      ),
      runCheckpointState: runCheckpoints,
      browserAgentRunSdkState: browserAgentRuns,
      scheduledAutomationState: scheduledAutomations,
      actionHistoryState: workspaceActionHistory,
      fileHistories: [fileHistory],
      recentActivity: [{
        id: 'recent-research',
        title: 'Research Session',
        date: 'Today',
        preview: 'Investigated browser-safe ONNX models',
        events: ['Opened Hugging Face registry'],
      }],
    });

    expect(graph.rows.map((row) => row.kind)).toEqual(expect.arrayContaining([
      'session-squash',
      'branch-squash',
      'checkpoint',
      'browser-agent-run',
      'automation',
      'app-action-squash',
      'file-change',
      'recent-activity',
    ]));
    expect(graph.rows.map((row) => row.title)).toEqual(expect.arrayContaining([
      'Squash merge: Checkout fix',
      'Squash merge: Branch auth options',
      'Approval before deployment',
      'SDK launch smoke',
      'Daily workspace audit',
      'App actions: Opened History and updated run state',
      'File change: notes.md',
      'Research Session',
    ]));
    expect(graph.summary.timelineNodes).toBe(graph.rows.length);
    expect(graph.summary.lanes).toEqual(expect.arrayContaining([
      'main',
      'checkpoint/checkout-fix',
      'run/checkout-fix',
      'automation',
      'files',
      'activity',
    ]));
  });

  it('rolls up only direct subsequent history nodes with matching graph categories', () => {
    const graph = buildWorkspaceHistoryGraph({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sessions: [
        { id: 'later-merge', name: 'Later merge' },
        { id: 'earlier-merge', name: 'Earlier merge' },
        { id: 'second-later-merge', name: 'Second later merge' },
        { id: 'second-earlier-merge', name: 'Second earlier merge' },
      ],
      chapterState: createChapteredSessions([
        {
          sessionId: 'later-merge',
          sessionName: 'Later merge',
          messageId: 'message-later-merge',
          summary: 'Later squash merge summary.',
          updatedAt: '2026-05-10T10:06:00.000Z',
        },
        {
          sessionId: 'earlier-merge',
          sessionName: 'Earlier merge',
          messageId: 'message-earlier-merge',
          summary: 'Earlier squash merge summary.',
          updatedAt: '2026-05-10T10:05:00.000Z',
        },
        {
          sessionId: 'second-later-merge',
          sessionName: 'Second later merge',
          messageId: 'message-second-later-merge',
          summary: 'Second later squash merge summary.',
          updatedAt: '2026-05-10T10:02:00.000Z',
        },
        {
          sessionId: 'second-earlier-merge',
          sessionName: 'Second earlier merge',
          messageId: 'message-second-earlier-merge',
          summary: 'Second earlier squash merge summary.',
          updatedAt: '2026-05-10T10:01:00.000Z',
        },
      ]),
      conversationBranchingState: DEFAULT_CONVERSATION_BRANCHING_STATE,
      runCheckpointState: { ...runCheckpoints, checkpoints: [], audit: [] },
      browserAgentRunSdkState: { runs: [], events: [] },
      scheduledAutomationState: { automations: [], runs: [], inbox: [] },
      actionHistoryState: createSeparatedUiActionHistory(),
      recentActivity: [],
    });

    expect(graph.rows.map((row) => row.title)).toEqual([
      'Squash merge',
      'App actions',
      'Squash merge',
    ]);
    expect(graph.rows.map((row) => row.kind)).toEqual([
      'history-rollup',
      'history-rollup',
      'history-rollup',
    ]);
    expect(graph.rows[0].children?.map((row) => row.title)).toEqual([
      'Squash merge: Later merge',
      'Squash merge: Earlier merge',
    ]);
    expect(graph.rows[1].children?.map((row) => row.title)).toEqual([
      'App actions: Opened Models',
      'App actions: Opened History',
    ]);
    expect(graph.rows[2].children?.map((row) => row.title)).toEqual([
      'Squash merge: Second later merge',
      'Squash merge: Second earlier merge',
    ]);
    expect(graph.rows[0].detailRows.map((row) => row.label)).toEqual([
      'Squash merge: Later merge',
      'message:message-later-merge',
      'Squash merge: Earlier merge',
      'message:message-earlier-merge',
    ]);
    expect(graph.summary).toMatchObject({
      mainlineCommits: 2,
      squashMerges: 2,
      timelineNodes: 3,
    });
  });

  it('represents file CRDT operations as selectable file-version nodes', () => {
    const fileHistory = appendWorkspaceFileCrdtDiff(
      createWorkspaceFileCrdtHistory({
        workspaceId: 'ws-research',
        path: 'agent.md',
        content: 'draft',
        actorId: 'user',
        now: new Date('2026-05-09T15:00:00.000Z'),
      }),
      'draft\nready',
      {
        actorId: 'codex',
        now: new Date('2026-05-09T15:01:00.000Z'),
      },
    );

    const graph = buildWorkspaceHistoryGraph({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      sessions: [],
      chapterState: { ...chapteredSessions, sessions: {} },
      conversationBranchingState: DEFAULT_CONVERSATION_BRANCHING_STATE,
      runCheckpointState: { ...runCheckpoints, checkpoints: [], audit: [] },
      browserAgentRunSdkState: { runs: [], events: [] },
      scheduledAutomationState: { automations: [], runs: [], inbox: [] },
      actionHistoryState: DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      fileHistories: [fileHistory],
      recentActivity: [],
    });

    const fileRow = graph.rows.find((row) => row.kind === 'file-change');

    expect(fileRow).toMatchObject({
      title: 'File change: agent.md',
      branchName: 'files',
      statusLabel: 'diff',
      target: {
        kind: 'file-version',
        workspaceId: 'ws-research',
        filePath: 'agent.md',
        opId: fileHistory.headOpId,
      },
    });
    expect(fileRow?.detailRows).toEqual([
      expect.objectContaining({
        kind: 'file-diff',
        label: 'codex patch: +6 -0 at 5',
      }),
    ]);
  });
});
