import { ModelContext } from '../../webmcp/src/index';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpElicitationField,
  WorkspaceMcpElicitationRequest,
} from './workspaceToolTypes';

type RecallInput = {
  query?: string;
  limit?: number;
};

type ElicitationInput = {
  prompt?: string;
  reason?: string;
  fields?: unknown;
};

const DEFAULT_ELICITATION_FIELDS: WorkspaceMcpElicitationField[] = [{
  id: 'location',
  label: 'City or neighborhood',
  required: true,
  placeholder: 'Chicago, IL',
}];

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPositiveLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(20, Math.floor(value))
    : 5;
}

function normalizeFields(value: unknown): WorkspaceMcpElicitationField[] {
  if (!Array.isArray(value)) return DEFAULT_ELICITATION_FIELDS;
  const fields = value
    .map((field): WorkspaceMcpElicitationField | null => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return null;
      const record = field as Record<string, unknown>;
      const id = readString(record.id);
      const label = readString(record.label);
      if (!id || !label) return null;
      return {
        id,
        label,
        ...(typeof record.required === 'boolean' ? { required: record.required } : {}),
        ...(readString(record.placeholder) ? { placeholder: readString(record.placeholder) } : {}),
      };
    })
    .filter((field): field is WorkspaceMcpElicitationField => Boolean(field));
  return fields.length ? fields : DEFAULT_ELICITATION_FIELDS;
}

export function registerUserContextTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    getUserContextMemory,
    getBrowserLocation,
    onElicitUserInput,
    signal,
  } = options;

  modelContext.registerTool({
    name: 'recall_user_context',
    title: 'Recall user context',
    description: 'Search app-owned workspace/session memory for location context such as saved city or neighborhood before restaurant, nearby, or near-me tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as RecallInput;
      const query = readString(typedInput.query);
      const limit = readPositiveLimit(typedInput.limit);
      if (!getUserContextMemory) {
        return { status: 'empty' as const, ...(query ? { query } : {}), memories: [] };
      }
      return getUserContextMemory({ query, limit });
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_browser_location',
    title: 'Read browser location',
    description: 'Request browser geolocation for location-dependent restaurant, nearby, or near-me tasks before asking the user manually.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => getBrowserLocation?.() ?? ({
      status: 'unavailable' as const,
      reason: 'Browser location is not available in this workspace.',
    }),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'elicit_user_input',
    title: 'Elicit user input',
    description: 'Pause execution and show an MCP-style chat card requesting missing location, city, or neighborhood data for restaurant and near-me tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        reason: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              required: { type: 'boolean' },
              placeholder: { type: 'string' },
            },
            required: ['id', 'label'],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as ElicitationInput;
      const reason = readString(typedInput.reason);
      const request: WorkspaceMcpElicitationRequest = {
        prompt: readString(typedInput.prompt) ?? 'Please provide the missing information before I continue.',
        reason,
        fields: normalizeFields(typedInput.fields),
      };
      if (!onElicitUserInput) {
        return {
          status: 'needs_user_input' as const,
          requestId: `elicitation-${Date.now().toString(36)}`,
          prompt: request.prompt,
          fields: request.fields,
        };
      }
      return onElicitUserInput(request);
    },
  }, { signal });
}
