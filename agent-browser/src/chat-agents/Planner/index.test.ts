import { describe, expect, it, vi } from 'vitest';
import * as CodiModule from '../Codi';
import * as GhcpModule from '../Ghcp';
import {
  buildPlannerOperatingInstructions,
  buildPlannerRuntimeSnapshot,
  buildPlannerSystemPrompt,
  buildPlannerToolInstructions,
  createPlannerTaskRecord,
  isPlannerTaskText,
  normalizePlannerTaskId,
  renderPlannerTaskBoardMarkdown,
  streamPlannerChat,
  summarizePlannerRuntime,
  upsertPlannerTask,
} from './index';

describe('planner', () => {
  it('builds browser-native Planner instructions for Symphony-style orchestration', () => {
    const instructions = buildPlannerOperatingInstructions();

    expect(instructions).toContain('# Planner');
    expect(instructions).toContain('runs entirely in the browser');
    expect(instructions).toContain('offline');
    expect(instructions).toContain('local task management');
    expect(instructions).toContain('external task managers are optional');
    expect(instructions).toContain('ProcessLog');
    expect(instructions).toContain('AgentBus');
    expect(instructions).toContain('other device sessions');

    const systemPrompt = buildPlannerSystemPrompt({ workspaceName: 'Build' });
    expect(systemPrompt).toContain('Active workspace: Build');
    expect(systemPrompt).toContain('## Planner Operating Instructions');
  });

  it('detects planner-shaped orchestration requests without stealing normal chat', () => {
    expect(isPlannerTaskText('Plan and orchestrate this delegated agent workflow.')).toBe(true);
    expect(isPlannerTaskText('Monitor subagents and sync the task board.')).toBe(true);
    expect(isPlannerTaskText('Implement Symphony as a local-first planner agent.')).toBe(true);
    expect(isPlannerTaskText('Say hello.')).toBe(false);
  });

  it('creates and updates local-first task records deterministically', () => {
    const task = createPlannerTaskRecord({
      id: 'MT-649',
      title: 'Implement planner',
      description: 'Build the browser-native planner agent.',
      source: 'external',
      externalRef: {
        managerId: 'linear-main',
        kind: 'linear',
        identifier: 'MT-649',
        url: 'https://linear.app/team/issue/MT-649',
      },
      now: '2026-05-01T12:00:00.000Z',
    });

    expect(task).toEqual({
      id: 'mt-649',
      title: 'Implement planner',
      description: 'Build the browser-native planner agent.',
      status: 'pending',
      priority: null,
      source: 'external',
      labels: [],
      blockers: [],
      externalRef: {
        managerId: 'linear-main',
        kind: 'linear',
        identifier: 'MT-649',
        url: 'https://linear.app/team/issue/MT-649',
      },
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
    });

    const board = upsertPlannerTask([task], {
      id: 'mt-649',
      status: 'running',
      notes: 'Planner agent is executing locally.',
      now: '2026-05-01T12:05:00.000Z',
    });

    expect(board[0]).toEqual(expect.objectContaining({
      status: 'running',
      notes: 'Planner agent is executing locally.',
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:05:00.000Z',
    }));

    const appended = upsertPlannerTask([], {
      id: 'New Task!',
      title: 'New task',
      description: 'Append a new planner task.',
      labels: [' UI ', ''],
      blockers: ['MT 649'],
      now: '2026-05-01T12:10:00.000Z',
    });

    expect(appended[0]).toEqual(expect.objectContaining({
      id: 'new-task',
      labels: ['ui'],
      blockers: ['mt-649'],
    }));
    expect(normalizePlannerTaskId('!!!')).toBe('task');
  });

  it('summarizes local tasks, external managers, and agent session monitoring state', () => {
    const snapshot = buildPlannerRuntimeSnapshot({
      tasks: [
        createPlannerTaskRecord({
          id: 'local task',
          title: 'Local task',
          description: 'Offline task.',
          status: 'running',
          now: '2026-05-01T12:00:00.000Z',
        }),
        createPlannerTaskRecord({
          id: 'done task',
          title: 'Done task',
          description: 'Finished task.',
          status: 'done',
          now: '2026-05-01T12:00:00.000Z',
        }),
      ],
      externalManagers: [
        {
          id: 'linear-main',
          kind: 'linear',
          label: 'Linear',
          enabled: true,
          mode: 'mirror',
          lastSyncAt: '2026-05-01T11:59:00.000Z',
        },
      ],
      sessions: [
        {
          sessionId: 'thread-1-turn-1',
          agentId: 'planner',
          label: 'Planner',
          deviceId: 'laptop',
          source: 'local-tab',
          status: 'running',
          taskIds: ['local-task'],
          lastEvent: 'turn_completed',
          updatedAt: '2026-05-01T12:00:00.000Z',
        },
        {
          sessionId: 'thread-2-turn-1',
          agentId: 'worker',
          label: 'Worker',
          deviceId: 'tablet',
          source: 'external-device',
          status: 'stalled',
          taskIds: ['local-task'],
          lastEvent: 'no heartbeat',
          updatedAt: '2026-05-01T11:45:00.000Z',
        },
      ],
      now: '2026-05-01T12:01:00.000Z',
      staleAfterMs: 5 * 60_000,
    });

    expect(summarizePlannerRuntime(snapshot)).toEqual({
      tasks: { pending: 0, running: 1, done: 1, failed: 0, blocked: 0 },
      sessions: { running: 1, idle: 0, stalled: 1, stopped: 0, stale: 1 },
      externalManagers: { enabled: 1, disabled: 0, mirror: 1, authority: 0 },
    });
    expect(renderPlannerTaskBoardMarkdown(snapshot)).toContain('Local task [running]');
    expect(renderPlannerTaskBoardMarkdown(snapshot)).toContain('thread-2-turn-1 [stalled, stale]');
  });

  it('renders fallback and optional task-board fields for offline planner snapshots', () => {
    const emptySnapshot = buildPlannerRuntimeSnapshot({ now: '2026-05-01T12:00:00.000Z' });
    const emptyBoard = renderPlannerTaskBoardMarkdown(emptySnapshot);

    expect(emptyBoard).toContain('No local planner tasks recorded.');
    expect(emptyBoard).toContain('No monitored sessions recorded.');
    expect(emptyBoard).toContain('No external task managers configured.');

    const snapshot = buildPlannerRuntimeSnapshot({
      tasks: [
        createPlannerTaskRecord({
          id: 'External task',
          title: 'External task',
          description: 'External mirror task.',
          status: 'blocked',
          blockers: ['Dependency task'],
          source: 'external',
          notes: 'Waiting on handoff.',
          externalRef: {
            managerId: 'github-main',
            kind: 'github',
            identifier: 'GH-1',
          },
          now: '2026-05-01T12:00:00.000Z',
        }),
      ],
      externalManagers: [{
        id: 'github-main',
        kind: 'github',
        label: 'GitHub',
        enabled: false,
        mode: 'authority',
      }],
      sessions: [{
        sessionId: 'thread-3-turn-1',
        agentId: 'planner',
        label: 'Planner',
        deviceId: 'phone',
        source: 'external-device',
        status: 'idle',
        taskIds: [],
        updatedAt: '2026-05-01T11:59:00.000Z',
      }],
      now: '2026-05-01T12:00:00.000Z',
    });

    expect(summarizePlannerRuntime(snapshot)).toEqual({
      tasks: { pending: 0, running: 0, done: 0, failed: 0, blocked: 1 },
      sessions: { running: 0, idle: 1, stalled: 0, stopped: 0, stale: 0 },
      externalManagers: { enabled: 0, disabled: 1, mirror: 0, authority: 1 },
    });
    expect(renderPlannerTaskBoardMarkdown(snapshot)).toContain('External task [blocked] (github:GH-1) blockers: dependency-task - Waiting on handoff.');
    expect(renderPlannerTaskBoardMarkdown(snapshot)).toContain('thread-3-turn-1 [idle] Planner on phone; tasks: none; source: external-device;');
    expect(renderPlannerTaskBoardMarkdown(snapshot)).toContain('GitHub [disabled, authority] github');
  });

  it('builds Planner tool instructions for selected browser tools and local task artifacts', () => {
    const prompt = buildPlannerToolInstructions({
      workspaceName: 'Build',
      workspacePromptContext: 'AGENTS.md says: use TDD.',
      descriptors: [{ id: 'cli', label: 'CLI', description: 'Run shell commands.' }],
      selectedToolIds: ['cli'],
    });

    expect(prompt).toContain('## Tool Instructions');
    expect(prompt).toContain('Selected tool ids: cli');
    expect(prompt).toContain('.planner/tasks.json');
    expect(prompt).toContain('Run shell commands.');
  });

  it('streams Planner through GHCP or Codi with Planner system instructions', async () => {
    const ghcpSpy = vi.spyOn(GhcpModule, 'streamGhcpChat').mockResolvedValueOnce();
    const codiSpy = vi.spyOn(CodiModule, 'streamCodiChat').mockResolvedValueOnce();
    const callbacks = {};

    await streamPlannerChat({
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      messages: [{ id: 'user-1', role: 'user', content: 'Plan the work.' }],
      workspaceName: 'Build',
      workspacePromptContext: 'Use workspace files.',
      latestUserInput: 'Plan the work.',
    }, callbacks);

    expect(ghcpSpy).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      systemPrompt: expect.stringContaining('## Planner Operating Instructions'),
    }), callbacks, undefined);

    await streamPlannerChat({
      runtimeProvider: 'codi',
      model: {
        id: 'model-a',
        name: 'Model A',
        author: 'A',
        task: 'text-generation',
        downloads: 1,
        likes: 1,
        tags: [],
        sizeMB: 1,
        status: 'installed',
      },
      messages: [{ id: 'user-1', role: 'user', content: 'Monitor agents.' }],
      workspaceName: 'Build',
      workspacePromptContext: 'Use workspace files.',
      latestUserInput: 'Monitor agents.',
    }, callbacks);

    expect(codiSpy).toHaveBeenCalledWith(expect.objectContaining({
      latestUserInput: 'Monitor agents.',
      systemPrompt: expect.stringContaining('runs entirely in the browser'),
    }), callbacks, undefined);
  });

  it('rejects missing Planner runtime dependencies', async () => {
    await expect(streamPlannerChat({
      runtimeProvider: 'ghcp',
      messages: [],
      workspaceName: 'Build',
      workspacePromptContext: '',
      latestUserInput: 'Plan this.',
    }, {})).rejects.toThrow('Planner GHCP chat requires a modelId and sessionId.');

    await expect(streamPlannerChat({
      runtimeProvider: 'codi',
      messages: [],
      workspaceName: 'Build',
      workspacePromptContext: '',
      latestUserInput: 'Plan this.',
    }, {})).rejects.toThrow('Planner Codi chat requires a local model.');
  });
});
