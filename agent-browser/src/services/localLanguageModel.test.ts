import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateMock = vi.fn();

vi.mock('./browserInference', () => ({
  browserInferenceEngine: {
    generate: (...args: unknown[]) => generateMock(...args),
  },
}));

import { LocalLanguageModel } from './localLanguageModel';

async function readStream(stream: ReadableStream<unknown>) {
  const reader = stream.getReader();
  const parts: unknown[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }

  return parts;
}

describe('LocalLanguageModel', () => {
  beforeEach(() => {
    generateMock.mockReset();
  });

  it('injects ReAct tool instructions and returns tool calls from doGenerate', async () => {
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onToken?.('<tool_call>{"tool":"cli","args":{"command":"pwd"}}</tool_call>');
      callbacks.onDone?.({ ok: true });
      return undefined;
    });

    const model = new LocalLanguageModel('hf-test-model');
    const result = await model.doGenerate({
      abortSignal: undefined,
      prompt: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: [{ type: 'text', text: 'Inspect the workspace.' }] },
      ],
      tools: [{
        type: 'function',
        name: 'cli',
        description: 'Run a command.',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to run' },
          },
        },
      }],
    } as never);

    expect(generateMock.mock.calls[0][0].prompt[0].content).toContain('## Tools');
    expect(result.finishReason).toEqual({ unified: 'tool-calls', raw: 'tool-calls' });
    expect(result.content[0]).toMatchObject({
      type: 'tool-call',
      toolName: 'cli',
      input: JSON.stringify({ command: 'pwd' }),
    });
  });

  it('returns plain text when no tool call is emitted', async () => {
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onToken?.('plain answer');
      callbacks.onDone?.({ ok: true });
      return undefined;
    });

    const model = new LocalLanguageModel('hf-test-model');
    const result = await model.doGenerate({
      abortSignal: undefined,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello.' }] }],
      tools: [],
    } as never);

    expect(result.content).toEqual([{ type: 'text', text: 'plain answer' }]);
  });

  it('streams token deltas through doStream and closes with a finish event', async () => {
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onToken?.('hello');
      callbacks.onToken?.(' world');
      callbacks.onDone?.({ ok: true });
      return undefined;
    });

    const model = new LocalLanguageModel('hf-test-model');
    const result = await model.doStream({
      abortSignal: undefined,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Stream please.' }] }],
      tools: [],
    } as never);

    const parts = await readStream(result.stream);
    expect(parts).toEqual([
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', delta: 'hello' },
      { type: 'text-delta', id: 'text-0', delta: ' world' },
      { type: 'text-end', id: 'text-0' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
      },
    ]);
  });

  it('streams errors when the inference engine rejects during doStream', async () => {
    generateMock.mockRejectedValueOnce(new Error('stream failed'));

    const model = new LocalLanguageModel('hf-test-model');
    const result = await model.doStream({
      abortSignal: undefined,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Stream please.' }] }],
      tools: [],
    } as never);

    const parts = await readStream(result.stream);
    expect(parts.slice(0, 2)).toEqual([
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 'text-0' },
    ]);
    expect(parts[2]).toMatchObject({
      type: 'error',
      error: expect.objectContaining({ message: 'stream failed' }),
    });
  });
});