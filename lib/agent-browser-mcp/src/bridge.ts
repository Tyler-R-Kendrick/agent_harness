import { jsonSchema, tool, type ToolSet } from 'ai';
import {
  getModelContextRegistry,
  invokeModelContextTool,
  ModelContext,
  ModelContextClient,
  type RegisteredToolDefinition,
} from 'webmcp';

import type { WebMcpToolDescriptor } from './types';

const WEBMCP_TOOL_ID_PREFIX = 'webmcp:';
const WEBMCP_GROUP_LABEL = 'WebMCP';
const DEFAULT_INPUT_SCHEMA = { type: 'object', properties: {} };

export interface WebMcpToolBridgeOptions {
  createClient?: () => ModelContextClient;
}

export interface WebMcpToolBridge {
  createToolSet(): ToolSet;
  getDescriptors(): WebMcpToolDescriptor[];
  subscribe(listener: () => void): () => void;
}

type ToolRegistryLike = {
  list(): RegisteredToolDefinition[];
  subscribe(listener: () => void): () => void;
};

export function toWebMcpToolId(name: string): string {
  return `${WEBMCP_TOOL_ID_PREFIX}${name}`;
}

function toDescriptor(definition: RegisteredToolDefinition): WebMcpToolDescriptor {
  return {
    id: toWebMcpToolId(definition.name),
    label: definition.title?.trim() || definition.name,
    description: definition.description,
    group: 'webmcp',
    groupLabel: WEBMCP_GROUP_LABEL,
  };
}

function toInputSchema(definition: RegisteredToolDefinition): Record<string, unknown> {
  const schema = definition.rawInputSchema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return DEFAULT_INPUT_SCHEMA;
  }

  return schema as Record<string, unknown>;
}

function toInvocationInput(input: unknown): object {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('WebMCP tool input must be an object.');
  }

  return input;
}

function toRegistry(modelContext: ModelContext): ToolRegistryLike | null {
  const registry = getModelContextRegistry(modelContext) as ToolRegistryLike | undefined;
  if (!registry || typeof registry.list !== 'function' || typeof registry.subscribe !== 'function') {
    return null;
  }

  return registry;
}

function toTool(
  modelContext: ModelContext,
  definition: RegisteredToolDefinition,
  createClient: () => ModelContextClient,
) {
  return tool({
    description: definition.description,
    inputSchema: jsonSchema(toInputSchema(definition)),
    execute: async (input) => invokeModelContextTool(modelContext, definition.name, toInvocationInput(input), createClient()),
  });
}

export function createWebMcpToolBridge(
  modelContext: ModelContext,
  options: WebMcpToolBridgeOptions = {},
): WebMcpToolBridge {
  const registry = toRegistry(modelContext);
  const createClient = options.createClient ?? (() => new ModelContextClient());

  return {
    createToolSet() {
      if (!registry) {
        return {} as ToolSet;
      }

      return Object.fromEntries(
        registry.list().map((definition) => [toWebMcpToolId(definition.name), toTool(modelContext, definition, createClient)]),
      ) as ToolSet;
    },
    getDescriptors() {
      if (!registry) {
        return [];
      }

      return registry.list().map(toDescriptor).sort((left, right) => left.label.localeCompare(right.label));
    },
    subscribe(listener) {
      if (!registry) {
        return () => undefined;
      }

      return registry.subscribe(() => listener());
    },
  };
}
