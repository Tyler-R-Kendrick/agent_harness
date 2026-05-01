import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import {
  CloudflareCodeModeExecutor,
  LocalCodeModeExecutor,
  createCodeModeExecutor,
} from './codeMode';

const OriginalFunction = globalThis.Function;

afterEach(() => {
  globalThis.Function = OriginalFunction;
  delete (globalThis as typeof globalThis & { __codemodeSideEffect?: boolean }).__codemodeSideEffect;
});

describe('codeMode', () => {
  it('parses JSON-returning local code mode results without executing code', async () => {
    const executor = new LocalCodeModeExecutor();

    await expect(executor.executeCode({
      code: 'async () => ({"id":"tool","ok":true,"nested":{"count":1}})',
    })).resolves.toEqual({
      code: 'async () => ({"id":"tool","ok":true,"nested":{"count":1}})',
      result: { id: 'tool', ok: true, nested: { count: 1 } },
      logs: [],
    });
  });

  it('rejects executable local code mode payloads', async () => {
    const executor = new LocalCodeModeExecutor();

    const result = await executor.executeCode({
      code: 'async () => { globalThis.__codemodeSideEffect = true; return {"ok":true}; }',
    });

    expect(result.result).toBeNull();
    expect(result.logs).toEqual([]);
    expect(result.error).toContain('JSON-returning arrow functions');
    expect((globalThis as typeof globalThis & { __codemodeSideEffect?: boolean }).__codemodeSideEffect).toBeUndefined();
  });

  it('falls back to the raw Cloudflare executor when the wrapper import is unavailable', async () => {
    globalThis.Function = function unavailableFunctionConstructor() {
      throw new Error('wrapper unavailable');
    } as unknown as FunctionConstructor;

    const toolExecute = vi.fn(async (args: unknown) => ({ echoed: args }));
    const executor = {
      execute: vi.fn(async (_code: string, providersOrFns: unknown) => {
        const providers = providersOrFns as Array<{ name: string; fns: Record<string, (args: unknown) => Promise<unknown>> }>;
        const toolResult = await providers[0].fns.echo({ value: 1 });
        return { result: { toolResult }, logs: ['fallback'] };
      }),
    };

    const result = await new CloudflareCodeModeExecutor(executor).executeCode({
      code: 'async () => ({"ok":true})',
      bindings: [{ namespace: 'helpers', tools: { echo: { execute: toolExecute } } as unknown as ToolSet }],
    });

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(toolExecute).toHaveBeenCalledWith({ value: 1 });
    expect(result).toEqual({
      code: 'async () => ({"ok":true})',
      result: { toolResult: { echoed: { value: 1 } } },
      logs: ['fallback'],
    });
  });

  it('uses the Cloudflare CodeMode wrapper when available', async () => {
    const wrappedExecute = vi.fn(async () => ({
      result: { wrapped: true },
      logs: ['wrapped'],
    }));
    const createCodeTool = vi.fn(() => ({ execute: wrappedExecute }));

    globalThis.Function = function mockedFunctionConstructor(_specifier: string, body: string) {
      if (body === 'return import(specifier)') {
        return async () => ({ createCodeTool });
      }
      return OriginalFunction(_specifier, body);
    } as unknown as FunctionConstructor;

    const executor = {
      execute: vi.fn(async () => ({ result: { shouldNotRun: true } })),
    };

    const result = await new CloudflareCodeModeExecutor(executor).executeCode({
      code: 'async () => ({"ok":true})',
      bindings: [{ namespace: 'helpers', tools: {} as ToolSet }],
    });

    expect(createCodeTool).toHaveBeenCalledWith({
      tools: [{ name: 'helpers', tools: {} }],
      executor,
    });
    expect(wrappedExecute).toHaveBeenCalledWith({ code: 'async () => ({"ok":true})' }, { toolCallId: 'codemode' });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result).toEqual({
      code: 'async () => ({"ok":true})',
      result: { wrapped: true },
      logs: ['wrapped'],
    });
  });

  it('creates the expected executor for local and Cloudflare runtimes', () => {
    const cloudflareExecutor = { execute: vi.fn() };

    expect(createCodeModeExecutor()).toBeInstanceOf(LocalCodeModeExecutor);
    expect(createCodeModeExecutor(cloudflareExecutor)).toBeInstanceOf(CloudflareCodeModeExecutor);
  });
});
