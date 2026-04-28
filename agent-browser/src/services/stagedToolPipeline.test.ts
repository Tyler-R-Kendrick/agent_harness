import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';

const runToolAgentMock = vi.fn();
const runLocalToolCallExecutorMock = vi.fn();

vi.mock('./agentRunner', () => ({
  runToolAgent: (options: unknown, callbacks: unknown) => runToolAgentMock(options, callbacks),
}));

vi.mock('./localToolCallExecutor', () => ({
  runLocalToolCallExecutor: (options: unknown, callbacks: unknown) =>
    runLocalToolCallExecutorMock(options, callbacks),
}));

import { planOrchestratorTasks, runStagedToolPipeline, selectStageDescriptors } from './stagedToolPipeline';
import type { ToolDescriptor } from '../tools';

function makeStreamingModel(text = 'Direct answer.') {
  return {
    provider: 'test-provider',
    modelId: 'test-model',
    doStream: vi.fn(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-delta', delta: text });
          controller.enqueue({ type: 'finish', finishReason: 'stop' });
          controller.close();
        },
      }),
    })),
  };
}

describe('stagedToolPipeline', () => {
  const toolDescriptors: ToolDescriptor[] = [
    {
      id: 'cli',
      label: 'CLI',
      description: 'Run shell commands.',
      group: 'built-in',
      groupLabel: 'Built-In',
    },
    {
      id: 'read_session_file',
      label: 'Read session file',
      description: 'Read a file from the active session filesystem.',
      group: 'built-in',
      groupLabel: 'Built-In',
      subGroup: 'files-worktree-mcp',
      subGroupLabel: 'Files',
    },
  ];

  beforeEach(() => {
    runToolAgentMock.mockReset();
    runLocalToolCallExecutorMock.mockReset();
  });

  it('decomposes and enriches orchestrator tasks before LogAct receives them', () => {
    const parallel = planOrchestratorTasks([
      { role: 'user', content: 'Inspect AGENTS.md and summarize package scripts.' },
    ], 'Research');
    const sequential = planOrchestratorTasks([
      { role: 'user', content: 'First inspect AGENTS.md, then summarize package scripts.' },
    ], 'Research');

    expect(parallel.mode).toBe('parallel');
    expect(parallel.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2']);
    expect(parallel.tasks[0].prompt).toContain('Orchestrator task 1 of 2');
    expect(parallel.tasks[0].prompt).toContain('Enhanced task prompt');
    expect(parallel.tasks[0].prompt).toContain('Inspect AGENTS.md');
    expect(parallel.tasks[1].prompt).toContain('summarize package scripts');

    expect(sequential.mode).toBe('sequential');
    expect(sequential.tasks.map((task) => task.dependsOnPrevious)).toEqual([false, true]);
    expect(sequential.tasks[1].prompt).toContain('Sequence dependency: use prior task results before starting this task.');
  });

  it('adds runtime verification criteria to orchestrated tasks', () => {
    const planned = planOrchestratorTasks([
      { role: 'user', content: "what're the best movie theaters near me?" },
    ], 'Research');
    const task = planned.tasks[0] as (typeof planned.tasks)[number] & { verificationCriteria: string[] };

    expect(task.verificationCriteria).toEqual(expect.arrayContaining([
      expect.stringMatching(/actual named entities/i),
      expect.stringMatching(/entity-specific/i),
      expect.stringMatching(/requested subject/i),
      expect.stringMatching(/geographic|near/i),
      expect.stringMatching(/navigation labels/i),
    ]));
    expect(task.prompt).toContain('Verification criteria:');
    expect(task.prompt).toContain('Generic page/navigation labels are forbidden');
  });

  it('routes tool-enabled requests through chat, orchestrator, LogAct tool planning, and the executor', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel();
    const events: string[] = [];
    const onStageStart = vi.fn((stage: string, _summary?: string, _meta?: unknown) => events.push(`stage:${stage}`));
    const onToolAgentEvent = vi.fn((event: { kind: string; branchId: string }) => (
      events.push(`tool-agent:${event.kind}:${event.branchId}`)
    ));
    const onAgentHandoff = vi.fn((from: string, to: string) => events.push(`handoff:${from}->${to}`));
    const onBusEntry = vi.fn();
    const onStageComplete = vi.fn((stage: string) => events.push(`complete:${stage}`));
    const onDone = vi.fn((text: string) => events.push(`done:${text}`));

    await runStagedToolPipeline({
      model: model as never,
      tools: { cli: { execute: vi.fn() }, read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md with the read session file tool.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageStart, onToolAgentEvent, onAgentHandoff, onBusEntry, onStageComplete, onDone });

    expect(model.doStream).not.toHaveBeenCalled();
    expect(onToolAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'plan',
      branchId: 'tool-agent',
    }));
    expect(onToolAgentEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      kind: 'codemode',
    }));
    expect(onStageStart.mock.calls.map(([stage]) => stage)).toEqual(expect.arrayContaining([
      'chat-agent',
      'orchestrator',
      'executor',
    ]));
    expect(onStageStart.mock.calls.map(([stage]) => stage)).not.toEqual(expect.arrayContaining([
      'planner',
      'router-agent',
      'router',
      'tool-agent',
      'group-select',
      'tool-select',
      'logact',
    ]));
    expect(onStageStart.mock.calls.find(([stage]) => stage === 'orchestrator')?.[2]).toMatchObject({
      agentId: 'orchestrator',
      agentLabel: 'Orchestrator Agent',
      modelId: 'test-model',
    });
    expect(onAgentHandoff.mock.calls.map(([from, to]) => `${from}->${to}`)).toEqual([
      'chat-agent->orchestrator',
      'orchestrator->logact',
      'logact->tool-agent',
      'logact->student-driver',
      'student-driver->voter:teacher',
      'voter:teacher->student-driver',
      'student-driver->voter:teacher',
      'judge-decider->adversary-driver',
      'logact->tool-agent',
      'logact->student-driver',
      'student-driver->voter:teacher',
      'voter:teacher->student-driver',
      'student-driver->voter:teacher',
      'judge-decider->adversary-driver',
      'logact->executor',
    ]);
    expect(events.indexOf('handoff:logact->tool-agent')).toBeLessThan(events.indexOf('tool-agent:plan:tool-agent'));
    expect(events.indexOf('tool-agent:plan:tool-agent')).toBeLessThan(events.indexOf('handoff:logact->student-driver'));
    expect(events.indexOf('handoff:logact->executor')).toBeLessThan(events.indexOf('stage:executor'));
    expect(events.indexOf('complete:executor')).toBeLessThan(events.indexOf('done:done'));
    expect(events.at(-1)).toBe('done:done');
    expect(onAgentHandoff.mock.calls.map(([from, to]) => `${from}->${to}`)).not.toContain('judge-decider->executor-agent');
    const busActors = onBusEntry.mock.calls.map(([entry]) => entry.actorId ?? entry.actor);
    expect(busActors).toEqual(expect.arrayContaining(['tool-agent', 'student-driver', 'voter:teacher']));
    expect(busActors).not.toContain('logact');
    const toolPolicyEntry = onBusEntry.mock.calls.find(([entry]) => (
      entry.actorId === 'tool-agent'
      && entry.payloadType === 'Policy'
      && entry.detail.includes('read_session_file')
    ))?.[0];
    expect(toolPolicyEntry).toMatchObject({
      actorRole: 'driver',
      parentActorId: 'logact',
      branchId: 'agent:tool-agent',
    });
    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
    expect(runToolAgentMock.mock.calls[0][0].tools.read_session_file).toBeDefined();
  });

  it('runs each parallel orchestrator task as its own LogAct flow using the enriched task prompt', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const onStageToken = vi.fn();
    const onBusEntry = vi.fn();
    const onToolAgentEvent = vi.fn();

    const result = await runStagedToolPipeline({
      model: makeStreamingModel() as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md and summarize package scripts.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageToken, onBusEntry, onToolAgentEvent });

    expect(result.text).toBe('done\n\ndone');
    expect(result.steps).toBe(2);
    expect(runToolAgentMock).toHaveBeenCalledTimes(2);
    const prompts = runToolAgentMock.mock.calls.map(([options]) => (
      options.messages.map((message: { content: string }) => message.content).join('\n')
    ));
    expect(prompts.some((prompt) => prompt.includes('Original user request: Inspect AGENTS.md'))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes('Original user request: summarize package scripts'))).toBe(true);
    expect(prompts.join('\n')).not.toContain('Original user request: Orchestrator task');
    const toolPlanningGoals = onToolAgentEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.kind === 'plan')
      .map((event) => String(event.payload?.goal ?? ''));
    expect(toolPlanningGoals).toEqual(expect.arrayContaining([
      expect.stringContaining('Orchestrator task 1 of 2'),
      expect.stringContaining('Orchestrator task 2 of 2'),
    ]));
    expect(onBusEntry.mock.calls.map(([entry]) => entry.id)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^task-1:/),
      expect.stringMatching(/^task-2:/),
    ]));
    expect(onStageToken.mock.calls.some(([, text]) => (
      String(text).includes('Execution mode: parallel') && String(text).includes('task-1')
    ))).toBe(true);
  });

  it('falls back to direct chat only when no tool catalog is available', async () => {
    const model = makeStreamingModel('Direct answer.');
    const onDone = vi.fn();

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: {},
      toolDescriptors: [],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Please remember this note.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onDone });

    expect(result).toEqual({ text: 'Direct answer.', steps: 1 });
    expect(onDone).toHaveBeenCalledWith('Direct answer.');
    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(model.doStream).toHaveBeenCalledTimes(1);
  });

  it('does not emit CodeMode as a planning branch from the tool agent', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const onStageStart = vi.fn();

    await runStagedToolPipeline({
      model: makeStreamingModel() as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageStart });

    const codemodeStart = onStageStart.mock.calls.find(([, , meta]) => meta?.subStageId === 'codemode');
    expect(codemodeStart).toBeUndefined();
  });

  it('routes local providers through the local JSON tool-call executor with maxSteps capped at 6', async () => {
    runLocalToolCallExecutorMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = { ...makeStreamingModel(), provider: 'local' };

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      maxSteps: 20,
    }, {});

    expect(runToolAgentMock).not.toHaveBeenCalled();
    expect(runLocalToolCallExecutorMock).toHaveBeenCalledTimes(1);
    expect(runLocalToolCallExecutorMock.mock.calls[0][0].maxSteps).toBe(6);
  });

  it('does not reuse legacy executor voters for LogAct solution design', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'final attempt', steps: 1 });
    const voter = {
      id: 'legacy-tool-path-voter',
      tier: 'classic' as const,
      vote: vi.fn(),
    };
    const onVoterStep = vi.fn();

    const result = await runStagedToolPipeline({
      model: makeStreamingModel() as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      voters: [voter],
      maxIterations: 5,
    }, { onVoterStep });

    expect(result).toEqual({ text: 'final attempt', steps: 1 });
    expect(voter.vote).not.toHaveBeenCalled();
    expect(onVoterStep.mock.calls.map(([step]) => step.voterId)).toEqual([
      'voter:teacher',
      'voter:teacher',
      'voter:teacher',
      'voter:teacher',
    ]);
  });

  it('runs remote tool execution through dynamic LogAct actor agents and AgentBus output', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'remote tool result', steps: 1 });
    const onVoterStep = vi.fn();
    const onBusEntry = vi.fn();

    const result = await runStagedToolPipeline({
      model: makeStreamingModel() as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onVoterStep, onBusEntry });

    expect(result).toEqual({ text: 'remote tool result', steps: 1 });
    expect(onVoterStep.mock.calls.map(([step]) => step.voterId)).toEqual(expect.arrayContaining([
      'voter:teacher',
    ]));
    expect(onVoterStep.mock.calls.map(([step]) => step.voterId)).not.toEqual(expect.arrayContaining([
      'planner-decomposition',
      'orchestrator-agent-selection',
      'tool-agent-assignment',
    ]));
    const payloadTypes = onBusEntry.mock.calls.map(([entry]) => entry.payloadType);
    expect(payloadTypes).toEqual(expect.arrayContaining(['Mail', 'InfIn', 'InfOut', 'Intent', 'Vote', 'Commit', 'Result']));
    expect(onBusEntry.mock.calls.some(([entry]) => entry.payloadType === 'Result' && entry.detail === 'remote tool result')).toBe(true);
    expect(onBusEntry.mock.calls.map(([entry]) => entry.actorId ?? entry.actor)).toEqual(expect.arrayContaining([
      'tool-agent',
      'student-driver',
      'voter:teacher',
      'adversary-driver',
      'judge-decider',
      'executor',
      'execute-plan',
      'tools-selected',
      'judge-approved',
      'execution-complete',
      'workflow-complete',
    ]));
    expect(onBusEntry.mock.calls.map(([entry]) => entry.actorId ?? entry.actor)).not.toContain('logact');
    expect(onBusEntry.mock.calls.map(([entry]) => entry.actorId ?? entry.actor)).not.toEqual(expect.arrayContaining([
      'teacher-voter',
      'executor-agent',
    ]));
    const executorPrompt = [
      runToolAgentMock.mock.calls[0][0].instructions,
      ...runToolAgentMock.mock.calls[0][0].messages.map((message: { content: string }) => message.content),
    ].join('\n');
    expect(executorPrompt).toContain('Committed LogAct execution plan');
    expect(executorPrompt).toContain('Student solution');
    expect(executorPrompt).toContain('AgentBus context');
  });

  it('selectStageDescriptors preserves descriptor ordering for selected ids', () => {
    expect(selectStageDescriptors(toolDescriptors, ['read_session_file'])).toEqual([toolDescriptors[1]]);
  });
});
