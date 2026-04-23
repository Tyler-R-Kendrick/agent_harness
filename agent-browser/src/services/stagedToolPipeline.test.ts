import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType } from 'logact';

const runToolAgentMock = vi.fn();
const runLocalToolCallExecutorMock = vi.fn();

vi.mock('./agentRunner', () => ({
  runToolAgent: (options: unknown, callbacks: unknown) => runToolAgentMock(options, callbacks),
}));

vi.mock('./localToolCallExecutor', () => ({
  runLocalToolCallExecutor: (options: unknown, callbacks: unknown) =>
    runLocalToolCallExecutorMock(options, callbacks),
}));

import { runStagedToolPipeline, selectStageDescriptors } from './stagedToolPipeline';
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

  it('routes tool-enabled requests through the Tool Agent before the executor', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel();
    const onStageStart = vi.fn();
    const onToolAgentEvent = vi.fn();

    await runStagedToolPipeline({
      model: model as never,
      tools: { cli: { execute: vi.fn() }, read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md with the read session file tool.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageStart, onToolAgentEvent });

    expect(model.doStream).not.toHaveBeenCalled();
    expect(onToolAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'plan',
      branchId: 'tool-agent',
    }));
    expect(onToolAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'codemode',
      branchId: 'codemode',
      parentBranchId: 'tool-agent',
    }));
    expect(onStageStart).toHaveBeenCalledWith(
      'router',
      'Routing request through Tool Agent.',
      expect.objectContaining({ agentId: 'tool-agent', agentLabel: 'Tool Agent', modelId: 'test-model' }),
    );
    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
    expect(runToolAgentMock.mock.calls[0][0].tools.read_session_file).toBeDefined();
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

  it('emits CodeMode as a process-log branch flow during planning', async () => {
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
    expect(codemodeStart).toBeDefined();
    expect(codemodeStart?.[2]).toMatchObject({
      agentId: 'tool-agent',
      parentStageId: 'tool-agent',
      branchId: 'codemode',
      parentBranchId: 'tool-agent',
    });
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

  it('preserves remote executor voters and completion-checker retries', async () => {
    runToolAgentMock
      .mockResolvedValueOnce({ text: 'first attempt', steps: 1 })
      .mockResolvedValueOnce({ text: 'final attempt', steps: 1 });
    const checker = vi.fn()
      .mockResolvedValueOnce({
        type: PayloadType.Completion,
        intentId: 'ignored-1',
        done: false,
        score: 'med',
        feedback: 'Try again with the selected tool.',
      })
      .mockResolvedValueOnce({
        type: PayloadType.Completion,
        intentId: 'ignored-2',
        done: true,
        score: 'high',
        feedback: 'Task complete.',
      });
    const voter = {
      id: 'tool-path-voter',
      tier: 'classic' as const,
      async vote(intent: { intentId: string }) {
        return {
          type: PayloadType.Vote as PayloadType.Vote,
          intentId: intent.intentId,
          voterId: 'tool-path-voter',
          approve: true,
          thought: 'Executor plan looks safe.',
        };
      },
    };
    const voterUpdates: Array<Record<string, unknown>> = [];

    const result = await runStagedToolPipeline({
      model: makeStreamingModel() as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      voters: [voter],
      completionChecker: { check: checker },
      maxIterations: 5,
    }, {
      onVoterStepUpdate: (_id, patch) => voterUpdates.push(patch as Record<string, unknown>),
    });

    expect(result).toEqual({ text: 'final attempt', steps: 1 });
    expect(runToolAgentMock).toHaveBeenCalledTimes(2);
    expect(runToolAgentMock.mock.calls[1][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Try again with the selected tool.' }),
      ]),
    );
    expect(voterUpdates.some((patch) => patch.thought === 'Executor plan looks safe.')).toBe(true);
  });

  it('selectStageDescriptors preserves descriptor ordering for selected ids', () => {
    expect(selectStageDescriptors(toolDescriptors, ['read_session_file'])).toEqual([toolDescriptors[1]]);
  });
});
