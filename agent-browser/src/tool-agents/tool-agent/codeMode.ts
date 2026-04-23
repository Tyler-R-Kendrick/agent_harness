import type { ToolSet } from 'ai';

export interface CodeModeToolBinding {
  namespace: string;
  tools: ToolSet;
}

export interface CodeModeExecuteInput {
  code: string;
  bindings?: CodeModeToolBinding[];
}

export interface CodeModeExecuteResult {
  code: string;
  result: unknown;
  logs: string[];
  error?: string;
}

export interface CodeModeExecutor {
  executeCode(input: CodeModeExecuteInput): Promise<CodeModeExecuteResult>;
}

type CloudflareExecutor = {
  execute: (code: string, providersOrFns: unknown) => Promise<{ result: unknown; error?: string; logs?: string[] }>;
};

function toRunnableFunctions(bindings: readonly CodeModeToolBinding[]) {
  return bindings.map((binding) => ({
    name: binding.namespace,
    fns: Object.fromEntries(Object.entries(binding.tools).map(([name, candidate]) => {
      const runnable = candidate as { execute?: (args: unknown) => unknown | Promise<unknown> };
      return [
        name,
        async (args: unknown) => {
          if (typeof runnable.execute !== 'function') {
            throw new TypeError(`Tool "${name}" is not executable.`);
          }
          return runnable.execute(args);
        },
      ];
    })),
  }));
}

function createNamespaceProxy(binding: CodeModeToolBinding) {
  return Object.fromEntries(Object.entries(binding.tools).map(([name, candidate]) => {
    const runnable = candidate as { execute?: (args: unknown) => unknown | Promise<unknown> };
    return [
      name,
      async (args: unknown) => {
        if (typeof runnable.execute !== 'function') {
          throw new TypeError(`Tool "${name}" is not executable.`);
        }
        return runnable.execute(args);
      },
    ];
  }));
}

export class LocalCodeModeExecutor implements CodeModeExecutor {
  async executeCode({ code, bindings = [] }: CodeModeExecuteInput): Promise<CodeModeExecuteResult> {
    const logs: string[] = [];
    const namespaces = Object.fromEntries(bindings.map((binding) => [
      binding.namespace,
      createNamespaceProxy(binding),
    ]));
    const codemode = namespaces.codemode ?? {};
    const scopedConsole = {
      log: (...values: unknown[]) => logs.push(values.map((value) => String(value)).join(' ')),
      warn: (...values: unknown[]) => logs.push(values.map((value) => String(value)).join(' ')),
      error: (...values: unknown[]) => logs.push(values.map((value) => String(value)).join(' ')),
    };

    try {
      const runner = new Function(
        'codemode',
        'tools',
        'console',
        'globalThis',
        'window',
        'document',
        'fetch',
        'XMLHttpRequest',
        `"use strict"; return (${code})();`,
      ) as (
        codemodeNamespace: Record<string, unknown>,
        tools: Record<string, unknown>,
        consoleProxy: typeof scopedConsole,
        globalObject: undefined,
        windowObject: undefined,
        documentObject: undefined,
        fetchFunction: undefined,
        xhrConstructor: undefined,
      ) => unknown;
      const result = await runner(
        codemode,
        namespaces,
        scopedConsole,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      return { code, result, logs };
    } catch (error) {
      return {
        code,
        result: null,
        logs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export class CloudflareCodeModeExecutor implements CodeModeExecutor {
  constructor(private readonly executor: CloudflareExecutor) {}

  async executeCode({ code, bindings = [] }: CodeModeExecuteInput): Promise<CodeModeExecuteResult> {
    try {
      const load = new Function('specifier', 'return import(specifier)') as (
        specifier: string,
      ) => Promise<{
        createCodeTool: (options: { tools: unknown; executor: CloudflareExecutor }) => unknown;
      }>;
      const { createCodeTool } = await load('@cloudflare/codemode/ai');
      const codeTool = createCodeTool({
        tools: bindings.map((binding) => ({ name: binding.namespace, tools: binding.tools })),
        executor: this.executor,
      }) as { execute?: (input: { code: string }, options?: unknown) => Promise<CodeModeExecuteResult> };
      if (typeof codeTool.execute === 'function') {
        const result = await codeTool.execute({ code }, { toolCallId: 'codemode' });
        return { code, result: result.result, logs: result.logs ?? [], ...(result.error ? { error: result.error } : {}) };
      }
    } catch {
      // Fall through to the raw executor API. This keeps the adapter useful
      // in tests or Worker-like hosts where the AI SDK tool wrapper shape
      // changes while preserving the official CodeMode path when available.
    }

    const result = await this.executor.execute(code, toRunnableFunctions(bindings));
    return { code, result: result.result, logs: result.logs ?? [], ...(result.error ? { error: result.error } : {}) };
  }
}

export function createCodeModeExecutor(executor?: CloudflareExecutor): CodeModeExecutor {
  return executor ? new CloudflareCodeModeExecutor(executor) : new LocalCodeModeExecutor();
}
