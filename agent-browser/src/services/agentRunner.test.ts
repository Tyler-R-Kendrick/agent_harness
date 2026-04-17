import { describe, expect, it, vi, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod/v4';

// Mock AI SDK generateText so we don't hit a real LLM
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from 'ai';
import { runToolAgent, type AgentRunOptions } from './agentRunner';

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeModel() {
  return {
    specificationVersion: 'v3' as const,
    provider: 'test',
    modelId: 'test-model',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };
}

const echoTool = tool({
  description: 'Echo a message back',
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }: { message: string }) => `echoed: ${message}`,
});

// ── runToolAgent ──────────────────────────────────────────────────────────────

describe('runToolAgent', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  it('calls generateText with model, tools, system, and messages', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'done',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    const model = makeModel();
    const options: AgentRunOptions = {
      model: model as never,
      tools: { echo: echoTool },
      instructions: 'You are a helpful agent.',
      messages: [{ role: 'user', content: 'Please echo hello' }],
    };

    await runToolAgent(options, {});

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: model,
        tools: { echo: echoTool },
        system: 'You are a helpful agent.',
        messages: options.messages,
        stopWhen: expect.any(Function),
      }),
    );
  });

  it('invokes onToken callback for each text chunk', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'hello world',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    const onToken = vi.fn();
    const model = makeModel();
    await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [] },
      { onToken },
    );

    expect(onToken).toHaveBeenCalledWith('hello world');
  });

  it('invokes onDone with final text', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'final answer',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    const onDone = vi.fn();
    const model = makeModel();
    await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [] },
      { onDone },
    );

    expect(onDone).toHaveBeenCalledWith('final answer');
  });

  it('invokes onError and rejects when generateText throws', async () => {
    const error = new Error('LLM failed');
    mockGenerateText.mockRejectedValueOnce(error);

    const onError = vi.fn();
    const model = makeModel();
    await expect(
      runToolAgent(
        { model: model as never, tools: {}, instructions: '', messages: [] },
        { onError },
      ),
    ).rejects.toThrow('LLM failed');

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('passes abort signal to generateText', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    const controller = new AbortController();
    const model = makeModel();
    await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [], signal: controller.signal },
      {},
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: controller.signal }),
    );
  });

  it('uses maxSteps from options', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    const model = makeModel();
    await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [], maxSteps: 3 },
      {},
    );

    const call = mockGenerateText.mock.calls[0][0] as { stopWhen: (options: { steps: unknown[] }) => boolean };
    expect(call.stopWhen({ steps: [1, 2] })).toBe(false);
    expect(call.stopWhen({ steps: [1, 2, 3] })).toBe(true);
  });

  it('returns the final text result', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'the answer',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    const model = makeModel();
    const result = await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [] },
      {},
    );

    expect(result.text).toBe('the answer');
  });

  it('emits tool call and tool result callbacks from completed steps', async () => {
    mockGenerateText.mockImplementationOnce(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolCallId: 'call-1', toolName: 'cli', input: { command: 'echo hello' } }],
        toolResults: [{ toolCallId: 'call-1', toolName: 'cli', input: { command: 'echo hello' }, output: { stdout: 'hello', stderr: '', exitCode: 0 }, isError: false }],
      });

      return {
        text: 'done',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    });

    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const model = makeModel();

    await runToolAgent(
      { model: model as never, tools: { echo: echoTool }, instructions: '', messages: [] },
      { onToolCall, onToolResult },
    );

    expect(onToolCall).toHaveBeenCalledWith('cli', { command: 'echo hello' }, 'call-1');
    expect(onToolResult).toHaveBeenCalledWith('cli', { command: 'echo hello' }, { stdout: 'hello', stderr: '', exitCode: 0 }, false, 'call-1');
  });
});
