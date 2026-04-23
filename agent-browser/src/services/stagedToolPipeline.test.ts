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

function makeStreamingModel(responses: Record<string, string>) {
  return {
    doStream: vi.fn(async ({ prompt }) => {
      const system = prompt[0]?.content as string;
      const response = Object.entries(responses).find(([marker]) => system.includes(marker))?.[1] ?? '{"mode":"chat"}';

      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-0' });
            controller.enqueue({ type: 'text-delta', id: 'text-0', delta: response });
            controller.enqueue({ type: 'text-end', id: 'text-0' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 0, text: 0, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      };
    }),
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

  it('filters executor tools through router, group, and tool selection stages', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect the file"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"],"goal":"inspect the file"}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"],"goal":"inspect the file"}',
    });

    await runStagedToolPipeline({
      model: model as never,
      tools: { cli: { execute: vi.fn() }, read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(runToolAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({ read_session_file: expect.any(Object) }),
      }),
      expect.any(Object),
    );
    expect(runToolAgentMock.mock.calls[0][0].tools.cli).toBeUndefined();
  });

  it('falls back to chat mode when the router says no tool use is needed', async () => {
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"chat","goal":"answer directly"}',
      '## Memory / Recall Guidance': 'Direct answer.',
    });
    const onDone = vi.fn();

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: {},
      toolDescriptors: [],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Please remember this note and summarize it later.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onDone });

    expect(result).toEqual({ text: 'Direct answer.', steps: 2 });
    expect(onDone).toHaveBeenCalledWith('Direct answer.');
    expect(runToolAgentMock).not.toHaveBeenCalled();

    const chatPrompt = model.doStream.mock.calls[1]?.[0]?.prompt?.[0]?.content as string;
    expect(chatPrompt).toContain('## Persona');
    expect(chatPrompt).toContain('## Workspace Context');
    expect(chatPrompt).toContain('## Memory / Recall Guidance');
  });

  it('continues into the executor (no chat fallback) when the router output is empty so local models still get tools', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'used a tool', steps: 2 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect the file.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(result.text).toBe('used a tool');
    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
    expect(runLocalToolCallExecutorMock).not.toHaveBeenCalled();
  });

  it('ignores a router "chat" verdict when tools are available so the executor still runs', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'used a tool', steps: 2 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"chat","goal":"answer directly"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect the file.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(result.text).toBe('used a tool');
    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
  });

  it('continues into the executor when the router output is unparseable instead of falling back to chat', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'used a tool', steps: 2 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': 'maybe we should use a tool, not sure',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect the file.' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(result.text).toBe('used a tool');
    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
  });

  it('emits stage callbacks while planning', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect the file"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"],"goal":"inspect the file"}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"],"goal":"inspect the file"}',
    });
    const onStageStart = vi.fn();
    const onStageToken = vi.fn();
    const onStageComplete = vi.fn();

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageStart, onStageToken, onStageComplete });

    // router + group-select + tool-select parent aggregate + 1 sub-stage + executor
    expect(onStageStart).toHaveBeenCalledTimes(5);
    expect(onStageToken).toHaveBeenCalled();
    expect(onStageComplete).toHaveBeenCalledTimes(5);

    const toolSelectStarts = onStageStart.mock.calls.filter(([stage]) => stage === 'tool-select');
    expect(toolSelectStarts).toHaveLength(2);
    const subStageStart = toolSelectStarts.find(([, , meta]) => meta?.subStageId);
    expect(subStageStart?.[2]).toMatchObject({
      subStageId: 'files-worktree-mcp',
      parentStageId: 'tool-select',
    });
  });

  it('fans out tool-select per selected group and tolerates one failing group', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });

    // Model returns two groups in group-select; one tool-select call rejects.
    const baseResponses: Record<string, string> = {
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"do work"}',
      '## Tool Group Selection Guidance':
        '{"groups":["files-worktree-mcp","built-in"],"goal":"do work"}',
    };
    let toolSelectCallCount = 0;
    const model = {
      doStream: vi.fn(async ({ prompt }) => {
        const system = prompt[0]?.content as string;
        const matchKey = Object.keys(baseResponses).find((k) => system.includes(k));
        if (matchKey) {
          const text = baseResponses[matchKey];
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'text-delta', delta: text });
                controller.enqueue({ type: 'finish', finishReason: 'stop' });
                controller.close();
              },
            }),
          };
        }
        // tool-select per-group calls
        toolSelectCallCount += 1;
        if (toolSelectCallCount === 1) {
          throw new Error('group stalled');
        }
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({
                type: 'text-delta',
                delta: '{"toolIds":["cli"],"goal":"do work"}',
              });
              controller.enqueue({ type: 'finish', finishReason: 'stop' });
              controller.close();
            },
          }),
        };
      }),
    };

    const onStageStart = vi.fn();
    const onStageComplete = vi.fn();
    const onStageError = vi.fn();

    await runStagedToolPipeline({
      model: model as never,
      tools: {
        cli: { execute: vi.fn() },
        read_session_file: { execute: vi.fn() },
      } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Do work' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onStageStart, onStageComplete, onStageError });

    const toolSelectStarts = onStageStart.mock.calls.filter(([stage]) => stage === 'tool-select');
    // parent aggregate + one per group (2)
    expect(toolSelectStarts).toHaveLength(3);
    const subStageIds = toolSelectStarts
      .map(([, , meta]) => meta?.subStageId)
      .filter((id): id is string => Boolean(id))
      .sort();
    expect(subStageIds).toEqual(['built-in', 'files-worktree-mcp']);

    expect(onStageError).toHaveBeenCalledTimes(1);
    const errorCall = onStageError.mock.calls[0];
    expect(errorCall[0]).toBe('tool-select');
    expect(errorCall[2]?.subStageId).toBeDefined();

    // Pipeline still completes the parent and reaches executor.
    const parentComplete = onStageComplete.mock.calls.find(
      ([stage, , meta]) => stage === 'tool-select' && !meta?.subStageId,
    );
    expect(parentComplete).toBeDefined();
    expect(runToolAgentMock).toHaveBeenCalled();
  });

  it('falls back to heuristic group and tool selection when stage JSON is malformed', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"read the file"}',
      '## Tool Group Selection Guidance': 'The files tools look right for this request.',
      '## Tool Selection Guidance': 'Use the read session file tool.',
    });

    await runStagedToolPipeline({
      model: model as never,
      tools: { cli: { execute: vi.fn() }, read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors,
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(runToolAgentMock.mock.calls[0][0].tools.read_session_file).toBeDefined();
  });

  it('uses doGenerate when streaming is unavailable', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = {
      doGenerate: vi.fn(async ({ prompt }) => {
        const system = prompt[0]?.content as string;
        const response = Object.entries({
          '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect the file"}',
          '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
          '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
        }).find(([marker]) => system.includes(marker))?.[1] ?? '{"mode":"chat"}';

        return {
          content: [{ type: 'text', text: response }],
          usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } },
          finishReason: { unified: 'stop', raw: 'stop' },
          warnings: [],
        };
      }),
    };

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    expect(model.doGenerate).toHaveBeenCalled();
    expect(runToolAgentMock).toHaveBeenCalled();
  });

  it('selectStageDescriptors preserves descriptor ordering for selected ids', () => {
    expect(selectStageDescriptors(toolDescriptors, ['read_session_file'])).toEqual([toolDescriptors[1]]);
  });

  it('passes providerOptions.local.enableThinking=false and Qwen3 non-thinking sampling to stage calls', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    const firstCall = model.doStream.mock.calls[0][0] as { providerOptions?: Record<string, unknown> };
    expect(firstCall.providerOptions).toEqual({
      local: { enableThinking: false, topK: 20, minP: 0 },
    });
  });

  it('appends a /no_think suffix to planning stage user prompts so Qwen3 skips think blocks', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, {});

    const userParts = model.doStream.mock.calls.map((call: unknown[]) => {
      const prompt = (call[0] as { prompt: Array<{ role: string; content: unknown }> }).prompt;
      const userMessage = prompt.find((part) => part.role === 'user');
      const content = userMessage?.content as Array<{ type: string; text: string }>;
      return content[0]?.text ?? '';
    });

    expect(userParts.length).toBeGreaterThanOrEqual(3);
    for (const text of userParts) {
      expect(text).toMatch(/\/no_think\s*$/);
    }
  });

  it('routes local providers through the local JSON tool-call executor with maxSteps capped at 6', async () => {
    runLocalToolCallExecutorMock.mockResolvedValue({ text: 'done', steps: 1 });
    const streaming = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });
    const model = { ...streaming, provider: 'local' };

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

  it('preserves the caller maxSteps for remote models', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });

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

    expect(runToolAgentMock.mock.calls[0][0].maxSteps).toBe(20);
  });

  it('routes the executor phase through LogAct voters and surfaces their thoughts', async () => {
    runToolAgentMock.mockResolvedValue({ text: 'tool-answer', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
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
          thought: 'Executor plan looks safe; read-only file access only.',
        };
      },
    };

    const voterUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      voters: [voter],
    }, {
      onVoterStepUpdate: (id, patch) => {
        voterUpdates.push({ id, patch: patch as Record<string, unknown> });
      },
    });

    expect(runToolAgentMock).toHaveBeenCalledTimes(1);
    const thoughtUpdate = voterUpdates.find((u) => u.patch.thought !== undefined);
    expect(thoughtUpdate).toBeDefined();
    expect(thoughtUpdate?.patch.thought).toBe('Executor plan looks safe; read-only file access only.');
    expect(thoughtUpdate?.patch.approve).toBe(true);
  });

  it('re-runs the executor with checker feedback until the task is complete', async () => {
    runToolAgentMock
      .mockResolvedValueOnce({ text: 'first attempt', steps: 1 })
      .mockResolvedValueOnce({ text: 'final attempt', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });
    const checker = vi.fn()
      .mockResolvedValueOnce({
        type: 'Completion',
        intentId: 'ignored-1',
        done: false,
        score: 'med',
        feedback: 'The task is not complete. Verify the file contents and answer directly.',
      })
      .mockResolvedValueOnce({
        type: 'Completion',
        intentId: 'ignored-2',
        done: true,
        score: 'high',
        feedback: 'Task complete.',
      });
    const iterationUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Inspect AGENTS.md' }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      completionChecker: { check: checker },
      maxIterations: 5,
    }, {
      onIterationStepUpdate: (id, patch) => {
        iterationUpdates.push({ id, patch: patch as Record<string, unknown> });
      },
    });

    expect(result).toEqual({ text: 'final attempt', steps: 1 });
    expect(runToolAgentMock).toHaveBeenCalledTimes(2);
    expect(runToolAgentMock.mock.calls[1][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'The task is not complete. Verify the file contents and answer directly.',
        }),
      ]),
    );
    expect(iterationUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ patch: expect.objectContaining({ score: 'med', done: false }) }),
        expect.objectContaining({ patch: expect.objectContaining({ score: 'high', done: true }) }),
      ]),
    );
  });

  it('uses the default heuristic checker to retry execution tasks that only return a plan on the first pass', async () => {
    runToolAgentMock
      .mockResolvedValueOnce({ text: 'Plan:\n1. Inspect the file\n2. Update the code', steps: 1 })
      .mockResolvedValueOnce({ text: 'Implemented the fix and verified the tests pass.', steps: 1 });
    const model = makeStreamingModel({
      '## Tool Routing Guidance': '{"mode":"tool-use","goal":"inspect"}',
      '## Tool Group Selection Guidance': '{"groups":["files-worktree-mcp"]}',
      '## Tool Selection Guidance': '{"toolIds":["read_session_file"]}',
    });
    const onDone = vi.fn();

    const result = await runStagedToolPipeline({
      model: model as never,
      tools: { read_session_file: { execute: vi.fn() } } as unknown as ToolSet,
      toolDescriptors: [toolDescriptors[1]],
      instructions: 'You are a workspace agent.',
      messages: [{ role: 'user', content: 'Implement the fix and run the tests.' }],
      workspaceName: 'Build',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
    }, { onDone });

    expect(result).toEqual({ text: 'Implemented the fix and verified the tests pass.', steps: 1 });
    expect(runToolAgentMock).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('Implemented the fix and verified the tests pass.');
  });
});
