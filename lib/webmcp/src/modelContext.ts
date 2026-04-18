import { dispatchToolActivated, dispatchToolCanceled } from './events';
import { ModelContextClient } from './modelContextClient';
import { MODEL_CONTEXT_REGISTRY_SYMBOL, ToolRegistry } from './registry';
import type {
  InvokeToolOptions,
  ModelContextRegisterToolOptions,
  ModelContextTool,
  RegisteredToolDefinition,
} from './types';
import { MODEL_CONTEXT_TOOL_NAME_PATTERN } from './types';

function createAbortError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function createInvalidStateError(message: string): DOMException {
  return new DOMException(message, 'InvalidStateError');
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function serializeInputSchema(tool: ModelContextTool): string {
  if (!hasOwn(tool, 'inputSchema')) {
    return '';
  }

  const serialized = JSON.stringify(tool.inputSchema);
  if (serialized === undefined) {
    throw new TypeError('Tool inputSchema must be JSON-serializable.');
  }

  return serialized;
}

function toRegisteredToolDefinition(tool: ModelContextTool): RegisteredToolDefinition {
  const name = tool.name;
  const description = tool.description;

  if (name === '' || description === '') {
    throw createInvalidStateError('Tool name and description must not be empty.');
  }

  if (!MODEL_CONTEXT_TOOL_NAME_PATTERN.test(name)) {
    throw createInvalidStateError('Tool name must be 1-128 characters of ASCII alphanumeric, underscore, hyphen, or dot.');
  }

  return {
    name,
    title: tool.title,
    description,
    inputSchema: serializeInputSchema(tool),
    rawInputSchema: tool.inputSchema,
    execute: tool.execute,
    readOnlyHint: Boolean(tool.annotations?.readOnlyHint),
  };
}

export class ModelContext extends EventTarget {
  readonly [MODEL_CONTEXT_REGISTRY_SYMBOL] = new ToolRegistry();

  registerTool(tool: ModelContextTool, options: ModelContextRegisterToolOptions = {}): void {
    const registry = getModelContextRegistry(this);
    const definition = toRegisteredToolDefinition(tool);

    if (registry.has(definition.name)) {
      throw createInvalidStateError(`Tool \"${definition.name}\" is already registered.`);
    }

    const signal = options.signal;
    if (signal?.aborted) {
      console.warn(`WebMCP tool \"${definition.name}\" was not registered because its AbortSignal was already aborted.`);
      return;
    }

    registry.register(definition);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          registry.unregister(definition.name);
        },
        { once: true },
      );
    }
  }
}

export function getModelContextRegistry(modelContext: ModelContext): ToolRegistry {
  return modelContext[MODEL_CONTEXT_REGISTRY_SYMBOL];
}

export async function invokeModelContextTool(
  modelContext: ModelContext,
  toolName: string,
  input: object,
  client = new ModelContextClient(),
  options: InvokeToolOptions = {},
): Promise<unknown> {
  const registry = getModelContextRegistry(modelContext);
  const tool = registry.get(toolName);
  if (!tool) {
    throw createInvalidStateError(`Tool \"${toolName}\" is not registered.`);
  }

  const detail = { client, input, toolName };
  dispatchToolActivated(modelContext, detail);

  if (options.signal?.aborted) {
    dispatchToolCanceled(modelContext, detail);
    throw createAbortError();
  }

  let aborted = false;
  const abortListener = () => {
    aborted = true;
    dispatchToolCanceled(modelContext, detail);
  };

  options.signal?.addEventListener('abort', abortListener, { once: true });

  try {
    const result = await tool.execute(input, client);
    if (aborted) {
      throw createAbortError();
    }

    return result;
  } finally {
    options.signal?.removeEventListener('abort', abortListener);
  }
}