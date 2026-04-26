import { dispatchToolActivated, dispatchToolCanceled } from './events';
import { ModelContextClient } from './modelContextClient';
import {
  MODEL_CONTEXT_PROMPT_REGISTRY_SYMBOL,
  MODEL_CONTEXT_PROMPT_TEMPLATE_REGISTRY_SYMBOL,
  MODEL_CONTEXT_REGISTRY_SYMBOL,
  MODEL_CONTEXT_RESOURCE_REGISTRY_SYMBOL,
  PromptRegistry,
  PromptTemplateRegistry,
  ResourceRegistry,
  ToolRegistry,
} from './registry';
import type {
  InvokeToolOptions,
  ModelContextPrompt,
  ModelContextPromptTemplate,
  ModelContextRegisterPromptOptions,
  ModelContextRegisterPromptTemplateOptions,
  ModelContextRegisterResourceOptions,
  ModelContextRegisterToolOptions,
  ModelContextResource,
  ModelContextTool,
  RegisteredPromptDefinition,
  RegisteredPromptTemplateDefinition,
  RegisteredResourceDefinition,
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

function serializeInputSchema(definition: { inputSchema?: unknown }, kind: string): string {
  if (!hasOwn(definition, 'inputSchema')) {
    return '';
  }

  const serialized = JSON.stringify(definition.inputSchema);
  if (serialized === undefined) {
    throw new TypeError(`${kind} inputSchema must be JSON-serializable.`);
  }

  return serialized;
}

function validateNamedDefinition(name: string, description: string, kind: string): void {
  if (name === '' || description === '') {
    throw createInvalidStateError(`${kind} name and description must not be empty.`);
  }

  if (!MODEL_CONTEXT_TOOL_NAME_PATTERN.test(name)) {
    throw createInvalidStateError(`${kind} name must be 1-128 characters of ASCII alphanumeric, underscore, hyphen, or dot.`);
  }
}

function validateResourceUri(uri: string, description: string): void {
  if (uri === '' || description === '') {
    throw createInvalidStateError('Resource uri and description must not be empty.');
  }

  try {
    new URL(uri);
  } catch {
    throw createInvalidStateError('Resource uri must be a valid absolute URI.');
  }
}

function toRegisteredToolDefinition(tool: ModelContextTool): RegisteredToolDefinition {
  validateNamedDefinition(tool.name, tool.description, 'Tool');

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: serializeInputSchema(tool, 'Tool'),
    rawInputSchema: tool.inputSchema,
    execute: tool.execute,
    readOnlyHint: Boolean(tool.annotations?.readOnlyHint),
  };
}

function toRegisteredResourceDefinition(resource: ModelContextResource): RegisteredResourceDefinition {
  validateResourceUri(resource.uri, resource.description);

  return {
    uri: resource.uri,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
    read: resource.read,
  };
}

function toRegisteredPromptDefinition(prompt: ModelContextPrompt): RegisteredPromptDefinition {
  validateNamedDefinition(prompt.name, prompt.description, 'Prompt');

  return {
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    inputSchema: serializeInputSchema(prompt, 'Prompt'),
    rawInputSchema: prompt.inputSchema,
    render: prompt.render,
  };
}

function toRegisteredPromptTemplateDefinition(promptTemplate: ModelContextPromptTemplate): RegisteredPromptTemplateDefinition {
  validateNamedDefinition(promptTemplate.name, promptTemplate.description, 'Prompt template');

  return {
    name: promptTemplate.name,
    title: promptTemplate.title,
    description: promptTemplate.description,
    inputSchema: serializeInputSchema(promptTemplate, 'Prompt template'),
    rawInputSchema: promptTemplate.inputSchema,
    render: promptTemplate.render,
  };
}

type RegistryWithKeys<TDefinition> = {
  has(key: string): boolean;
  register(definition: TDefinition): void;
  unregister(key: string): boolean;
};

function registerDefinition<TDefinition>(
  registry: RegistryWithKeys<TDefinition>,
  key: string,
  definition: TDefinition,
  signal: AbortSignal | undefined,
  duplicateMessage: string,
  abortedMessage: string,
): void {
  if (registry.has(key)) {
    throw createInvalidStateError(duplicateMessage);
  }

  if (signal?.aborted) {
    console.warn(abortedMessage);
    return;
  }

  registry.register(definition);

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        registry.unregister(key);
      },
      { once: true },
    );
  }
}

export class ModelContext extends EventTarget {
  readonly [MODEL_CONTEXT_REGISTRY_SYMBOL] = new ToolRegistry();

  readonly [MODEL_CONTEXT_RESOURCE_REGISTRY_SYMBOL] = new ResourceRegistry();

  readonly [MODEL_CONTEXT_PROMPT_REGISTRY_SYMBOL] = new PromptRegistry();

  readonly [MODEL_CONTEXT_PROMPT_TEMPLATE_REGISTRY_SYMBOL] = new PromptTemplateRegistry();

  registerTool(tool: ModelContextTool, options: ModelContextRegisterToolOptions = {}): void {
    const definition = toRegisteredToolDefinition(tool);
    registerDefinition(
      getModelContextRegistry(this),
      definition.name,
      definition,
      options.signal,
      `Tool "${definition.name}" is already registered.`,
      `WebMCP tool "${definition.name}" was not registered because its AbortSignal was already aborted.`,
    );
  }

  registerResource(resource: ModelContextResource, options: ModelContextRegisterResourceOptions = {}): void {
    const definition = toRegisteredResourceDefinition(resource);
    registerDefinition(
      getModelContextResourceRegistry(this),
      definition.uri,
      definition,
      options.signal,
      `Resource "${definition.uri}" is already registered.`,
      `WebMCP resource "${definition.uri}" was not registered because its AbortSignal was already aborted.`,
    );
  }

  registerPrompt(prompt: ModelContextPrompt, options: ModelContextRegisterPromptOptions = {}): void {
    const definition = toRegisteredPromptDefinition(prompt);
    registerDefinition(
      getModelContextPromptRegistry(this),
      definition.name,
      definition,
      options.signal,
      `Prompt "${definition.name}" is already registered.`,
      `WebMCP prompt "${definition.name}" was not registered because its AbortSignal was already aborted.`,
    );
  }

  registerPromptTemplate(
    promptTemplate: ModelContextPromptTemplate,
    options: ModelContextRegisterPromptTemplateOptions = {},
  ): void {
    const definition = toRegisteredPromptTemplateDefinition(promptTemplate);
    registerDefinition(
      getModelContextPromptTemplateRegistry(this),
      definition.name,
      definition,
      options.signal,
      `Prompt template "${definition.name}" is already registered.`,
      `WebMCP prompt template "${definition.name}" was not registered because its AbortSignal was already aborted.`,
    );
  }
}

export function getModelContextRegistry(modelContext: ModelContext): ToolRegistry {
  return modelContext[MODEL_CONTEXT_REGISTRY_SYMBOL];
}

export function getModelContextResourceRegistry(modelContext: ModelContext): ResourceRegistry {
  return modelContext[MODEL_CONTEXT_RESOURCE_REGISTRY_SYMBOL];
}

export function getModelContextPromptRegistry(modelContext: ModelContext): PromptRegistry {
  return modelContext[MODEL_CONTEXT_PROMPT_REGISTRY_SYMBOL];
}

export function getModelContextPromptTemplateRegistry(modelContext: ModelContext): PromptTemplateRegistry {
  return modelContext[MODEL_CONTEXT_PROMPT_TEMPLATE_REGISTRY_SYMBOL];
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
    try {
      const result = await tool.execute(input, client);
      if (aborted) {
        throw createAbortError();
      }

      return result;
    } catch (error) {
      if (aborted) {
        throw createAbortError();
      }

      throw error;
    }
  } finally {
    options.signal?.removeEventListener('abort', abortListener);
  }
}
