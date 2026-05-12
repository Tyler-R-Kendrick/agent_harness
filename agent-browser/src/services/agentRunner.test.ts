import { describe, expect, it, vi, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod/v4';

// Mock AI SDK generateText so we don't hit a real LLM
vi.mock('ai', async (importOriginal: () => Promise<typeof import('ai')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from 'ai';
import { runToolAgent, type AgentRunOptions } from './agentRunner';
import { MemorySecretStore, createSecretsManagerAgent } from '../chat-agents/Secrets';

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
        tools: expect.objectContaining({ echo: expect.objectContaining({ execute: expect.any(Function) }) }),
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

  it('fails closed with a fallback response when tool use stops without final text', async () => {
    mockGenerateText.mockImplementationOnce(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolCallId: 'call-1', toolName: 'weather', input: { city: 'Boston' } }],
        toolResults: [{
          toolCallId: 'call-1',
          toolName: 'weather',
          input: { city: 'Boston' },
          output: "It's 75 degrees and sunny in Boston.",
          isError: false,
        }],
      });

      return {
        text: '',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    });

    const onDone = vi.fn();
    const onToken = vi.fn();
    const model = makeModel();
    const result = await runToolAgent(
      { model: model as never, tools: { echo: echoTool }, instructions: '', messages: [] },
      { onDone, onToken },
    );

    expect(result).toEqual({
      text: 'I ran the requested tools, but the model stopped before producing a final answer. Please retry or narrow the request.',
      steps: 1,
      failed: true,
      error: 'Model stopped before producing a final answer after tool use.',
    });
    expect(onToken).toHaveBeenCalledWith(result.text);
    expect(onDone).toHaveBeenCalledWith(result.text);
  });

  it('fails closed with a fallback response when the model returns empty chat text', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '  ',
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

    expect(result).toEqual({
      text: 'The model stopped before producing a final answer. Please retry the request.',
      steps: 1,
      failed: true,
      error: 'Model stopped before producing a final answer.',
    });
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

  it('wraps non-error generateText rejections', async () => {
    mockGenerateText.mockRejectedValueOnce('string failure');

    const model = makeModel();
    await expect(
      runToolAgent(
        { model: model as never, tools: {}, instructions: '', messages: [] },
        {},
      ),
    ).rejects.toThrow('string failure');
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

  it('tracks generated step count when the provider does not return steps', async () => {
    mockGenerateText.mockImplementationOnce(async ({ onStepFinish }) => {
      onStepFinish?.({});
      onStepFinish?.({ toolCalls: [], toolResults: [] });
      return {
        text: 'done',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    });

    const model = makeModel();
    const result = await runToolAgent(
      { model: model as never, tools: {}, instructions: '', messages: [] },
      {},
    );

    expect(result).toEqual({ text: 'done', steps: 2 });
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

  it('prefers provider-reported step count when available', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'the answer',
      steps: [{}, {}, {}],
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

    expect(result.steps).toBe(3);
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

  it('handles provider step payloads without optional tool metadata', async () => {
    mockGenerateText.mockImplementationOnce(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolName: 'fallback-tool', input: { value: 1 } }],
        toolResults: [
          { result: 'fallback result', isError: true },
          { result: 'default ok' },
        ],
      });

      return {
        text: undefined,
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    });

    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const model = makeModel();

    const result = await runToolAgent(
      { model: model as never, tools: { echo: echoTool }, instructions: '', messages: [] },
      { onToolCall, onToolResult },
    );

    expect(onToolCall).toHaveBeenCalledWith('fallback-tool', { value: 1 }, undefined);
    expect(onToolResult).toHaveBeenCalledWith('unknown-tool', undefined, 'fallback result', true, undefined);
    expect(onToolResult).toHaveBeenCalledWith('unknown-tool', undefined, 'default ok', false, undefined);
    expect(result).toMatchObject({
      failed: true,
      error: 'Model stopped before producing a final answer after tool use.',
    });
  });

  it('sanitizes model inputs and wraps tools so only tool execution receives resolved secrets', async () => {
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
    const secretRef = 'secret-ref://local/github-token';
    const store = new MemorySecretStore();
    await store.set({
      id: 'github-token',
      value: secret,
      label: 'github-token',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    });
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: () => 'detected-token',
      now: () => '2026-04-30T00:00:00.000Z',
    });
    const authToolExecute = vi.fn(async ({ token }: { token: string }) => ({ echoed: token }));
    const authTool = tool({
      description: 'Calls a protected API',
      inputSchema: z.object({ token: z.string() }),
      execute: authToolExecute,
    });
    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const output = await (tools.auth as { execute: (input: unknown, options?: unknown) => Promise<unknown> })
        .execute({ token: secretRef }, { toolCallId: 'call-1' });
      expect(output).toEqual({ echoed: secretRef });
      return {
        text: 'done',
        toolCalls: [],
        toolResults: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    });

    const model = makeModel();
    await runToolAgent(
      {
        model: model as never,
        tools: { auth: authTool },
        instructions: `Use token ${secret}.`,
        messages: [{ role: 'user', content: `token=${secret}` }],
        secrets,
      },
      {},
    );

    const generateOptions = mockGenerateText.mock.calls[0][0] as {
      system: string;
      messages: Array<{ content: string }>;
    };
    expect(generateOptions.system).not.toContain(secret);
    expect(JSON.stringify(generateOptions.messages)).not.toContain(secret);
    expect(generateOptions.system).toContain(secretRef);
    expect(authToolExecute).toHaveBeenCalledWith({ token: secret }, { toolCallId: 'call-1' });
  });
});
