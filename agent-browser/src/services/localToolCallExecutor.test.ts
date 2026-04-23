import { describe, expect, it, vi } from 'vitest';
import type { ICompletionChecker, IVoter } from 'logact';
import { runLocalToolCallExecutor } from './localToolCallExecutor';

type StreamPart =
  | { type: 'text-delta'; delta: string }
  | { type: 'error'; error: unknown };

function makeStreamingModel(turns: string[]) {
  let turn = 0;
  const calls: Array<{ prompt: unknown; tools: unknown }> = [];
  const model = {
    provider: 'local' as const,
    async doStream(options: { prompt: unknown; tools: unknown }) {
      calls.push({ prompt: options.prompt, tools: options.tools });
      const text = turns[turn] ?? '';
      turn += 1;
      const parts: StreamPart[] = text
        ? [{ type: 'text-delta', delta: text }]
        : [];
      const stream = new ReadableStream<StreamPart>({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      });
      return { stream };
    },
  };
  return { model, calls, getTurnCount: () => turn };
}

function makeTool(execute: (args: unknown) => unknown | Promise<unknown>) {
  return { execute: vi.fn(execute) } as never;
}

describe('runLocalToolCallExecutor', () => {
  it('parses a JSON tool call, executes the tool, feeds the result back, and returns the final answer', async () => {
    const { model } = makeStreamingModel([
      '<tool_call>{"tool":"cli","args":{"command":"echo hi"}}</tool_call>',
      'Final answer: hi',
    ]);
    const cli = makeTool(({ command }: { command: string }) => `ran:${command}`);
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const onToken = vi.fn();
    const onDone = vi.fn();

    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [
          { id: 'cli', label: 'CLI', description: 'Run shell commands', group: 'built-in', groupLabel: 'Built-in' },
        ],
        instructions: 'You are a helpful agent.',
        messages: [{ role: 'user', content: 'do it' }],
        maxSteps: 6,
      },
      { onToolCall, onToolResult, onToken, onDone },
    );

    expect(result.text).toBe('Final answer: hi');
    expect(result.steps).toBe(2);
    expect(cli.execute).toHaveBeenCalledWith({ command: 'echo hi' }, expect.anything());
    expect(onToolCall).toHaveBeenCalledWith('cli', { command: 'echo hi' }, expect.any(String));
    expect(onToolResult).toHaveBeenCalledWith('cli', { command: 'echo hi' }, 'ran:echo hi', false, expect.any(String));
    expect(onDone).toHaveBeenCalledWith('Final answer: hi');
  });

  it('returns the final text immediately when the model emits no tool call', async () => {
    const { model } = makeStreamingModel(['Just an answer.']);
    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: {} as never,
        toolDescriptors: [],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
      },
      {},
    );
    expect(result.text).toBe('Just an answer.');
    expect(result.steps).toBe(1);
  });

  it('reports tool errors back to the model and continues looping', async () => {
    const { model } = makeStreamingModel([
      '<tool_call>{"tool":"cli","args":{"command":"bad"}}</tool_call>',
      'Recovered.',
    ]);
    const cli = makeTool(() => {
      throw new Error('boom');
    });
    const onToolResult = vi.fn();
    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [{ id: 'cli', label: 'CLI', description: '', group: 'built-in', groupLabel: 'Built-in' }],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'do it' }],
      },
      { onToolResult },
    );
    expect(result.text).toBe('Recovered.');
    expect(onToolResult).toHaveBeenCalledWith('cli', { command: 'bad' }, expect.stringContaining('boom'), true, expect.any(String));
  });

  it('stops after maxSteps even if the model keeps emitting tool calls', async () => {
    const { model, getTurnCount } = makeStreamingModel([
      '<tool_call>{"tool":"cli","args":{}}</tool_call>',
      '<tool_call>{"tool":"cli","args":{}}</tool_call>',
      '<tool_call>{"tool":"cli","args":{}}</tool_call>',
      '<tool_call>{"tool":"cli","args":{}}</tool_call>',
    ]);
    const cli = makeTool(() => 'ok');
    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [{ id: 'cli', label: 'CLI', description: '', group: 'built-in', groupLabel: 'Built-in' }],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'do it' }],
        maxSteps: 2,
      },
      {},
    );
    // Truncated; final text is what the model last produced.
    expect(getTurnCount()).toBe(2);
    expect(result.steps).toBe(2);
  });

  it('reports an unknown tool name back to the model so it can recover', async () => {
    const { model } = makeStreamingModel([
      '<tool_call>{"tool":"missing","args":{}}</tool_call>',
      'Sorry.',
    ]);
    const onToolResult = vi.fn();
    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: {} as never,
        toolDescriptors: [],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'x' }],
      },
      { onToolResult },
    );
    expect(result.text).toBe('Sorry.');
    expect(onToolResult).toHaveBeenCalledWith(
      'missing',
      {},
      expect.stringContaining('Unknown tool'),
      true,
      expect.any(String),
    );
  });

  it('runs the executor inside runAgentLoop when voters or a completion checker are provided', async () => {
    const { model } = makeStreamingModel(['ok']);
    const voter: IVoter = {
      id: 'always-yes',
      tier: 1,
      vote: vi.fn(async () => ({ approve: true, reason: 'ok' })),
    };
    const checker: ICompletionChecker = {
      check: vi.fn(async () => ({ done: true, score: 1, feedback: '' })),
    };
    const onVoterStep = vi.fn();
    const onIterationStep = vi.fn();

    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: {} as never,
        toolDescriptors: [],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        voters: [voter],
        completionChecker: checker,
      },
      { onVoterStep, onIterationStep },
    );
    expect(result.text).toBe('ok');
    expect(checker.check).toHaveBeenCalled();
    expect(onIterationStep).toHaveBeenCalled();
  });

  it('parses fenced JSON tool calls inside ```json blocks', async () => {
    const { model } = makeStreamingModel([
      '```json\n{"tool":"cli","args":{"command":"ls"}}\n```',
      'done',
    ]);
    const cli = makeTool(() => 'output');
    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [{ id: 'cli', label: 'CLI', description: '', group: 'built-in', groupLabel: 'Built-in' }],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'x' }],
      },
      {},
    );
    expect(result.text).toBe('done');
    expect(cli.execute).toHaveBeenCalledWith({ command: 'ls' }, expect.anything());
  });

  it('retries with a synthetic system nudge when the model returns naive text but tools are required', async () => {
    const { model, getTurnCount } = makeStreamingModel([
      // First turn: model ignores the tool catalog and emits a plan-only answer.
      'Sure! I will run `echo hi` for you.',
      // After the nudge, the model finally calls the tool.
      '<tool_call>{"tool":"cli","args":{"command":"echo hi"}}</tool_call>',
      'Final answer: hi',
    ]);
    const cli = makeTool(({ command }: { command: string }) => `ran:${command}`);

    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [
          { id: 'cli', label: 'CLI', description: 'Run shell commands', group: 'built-in', groupLabel: 'Built-in' },
        ],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'do it' }],
        maxSteps: 6,
      },
      {},
    );

    expect(getTurnCount()).toBe(3);
    expect(result.text).toBe('Final answer: hi');
    expect(cli.execute).toHaveBeenCalledWith({ command: 'echo hi' }, expect.anything());
  });

  it('gives up retrying after maxToolUseRetries and returns the last naive turn', async () => {
    const { model, getTurnCount } = makeStreamingModel([
      'I refuse to call tools.',
      'Still refusing.',
      'Final refusal.',
    ]);
    const cli = makeTool(() => 'ok');

    const result = await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [
          { id: 'cli', label: 'CLI', description: 'Run shell commands', group: 'built-in', groupLabel: 'Built-in' },
        ],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'do it' }],
        maxSteps: 6,
        maxToolUseRetries: 1,
      },
      {},
    );

    expect(getTurnCount()).toBe(2);
    expect(result.text).toBe('Still refusing.');
    expect(cli.execute).not.toHaveBeenCalled();
  });

  it('fires onModelTurnStart / onModelTurnEnd around each generation pass and reports parsed tool calls', async () => {
    const { model } = makeStreamingModel([
      '<tool_call>{"tool":"cli","args":{"command":"ls"}}</tool_call>',
      'Final.',
    ]);
    const cli = makeTool(() => 'ok');
    const onModelTurnStart = vi.fn();
    const onModelTurnEnd = vi.fn();

    await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: { cli } as never,
        toolDescriptors: [{ id: 'cli', label: 'CLI', description: '', group: 'built-in', groupLabel: 'Built-in' }],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'do it' }],
      },
      { onModelTurnStart, onModelTurnEnd },
    );

    expect(onModelTurnStart).toHaveBeenCalledTimes(2);
    expect(onModelTurnStart.mock.calls[0][1]).toBe(0);
    expect(onModelTurnStart.mock.calls[1][1]).toBe(1);
    expect(onModelTurnEnd).toHaveBeenCalledTimes(2);
    // First turn: tool call parsed.
    expect(onModelTurnEnd.mock.calls[0][2]).toEqual({ toolName: 'cli', args: { command: 'ls' } });
    // Second turn: no tool call.
    expect(onModelTurnEnd.mock.calls[1][2]).toBeNull();
  });

  it('mirrors LogAct bus appends to onBusEntry through the observed bus', async () => {
    const { model } = makeStreamingModel(['Just an answer.']);
    const onBusEntry = vi.fn();

    await runLocalToolCallExecutor(
      {
        model: model as never,
        tools: {} as never,
        toolDescriptors: [],
        instructions: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { onBusEntry },
    );

    // LogAct emits at least one Mail (user) + InfIn + InfOut + Result entry
    // for a single inference pass.
    expect(onBusEntry).toHaveBeenCalled();
    const payloadTypes = onBusEntry.mock.calls.map((call) => call[0].payloadType);
    expect(payloadTypes).toContain('Mail');
    expect(payloadTypes).toContain('InfIn');
    expect(payloadTypes).toContain('InfOut');
  });
});
