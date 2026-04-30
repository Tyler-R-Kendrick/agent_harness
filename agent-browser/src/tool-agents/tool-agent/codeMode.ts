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

const LOCAL_CODEMODE_RESULT_RE = /^\s*(?:async\s*)?\(\s*\)\s*=>\s*\(([\s\S]*)\)\s*;?\s*$/;
const LOCAL_CODEMODE_UNSUPPORTED_ERROR =
  'Local CodeMode only supports JSON-returning arrow functions. Configure a Cloudflare executor for broader code execution.';

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

function parseLocalCodeModeResult(code: string): unknown {
  const match = LOCAL_CODEMODE_RESULT_RE.exec(code);
  if (!match) {
    throw new TypeError(LOCAL_CODEMODE_UNSUPPORTED_ERROR);
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new TypeError(LOCAL_CODEMODE_UNSUPPORTED_ERROR);
  }
}

export class LocalCodeModeExecutor implements CodeModeExecutor {
  async executeCode({ code }: CodeModeExecuteInput): Promise<CodeModeExecuteResult> {
    const logs: string[] = [];

    try {
      const result = parseLocalCodeModeResult(code);
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
