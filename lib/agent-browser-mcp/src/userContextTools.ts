import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpElicitationField,
  WorkspaceMcpElicitationFieldType,
  WorkspaceMcpElicitationOption,
  WorkspaceMcpElicitationRequest,
  WorkspaceMcpSecretRequest,
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

type SecretRequestInput = {
  name?: string;
  prompt?: string;
  reason?: string;
};

const DEFAULT_ELICITATION_FIELDS: WorkspaceMcpElicitationField[] = [{
  id: 'location',
  label: 'City or neighborhood',
  required: true,
  placeholder: 'Chicago, IL',
}];

const ELICITATION_FIELD_TYPES = new Set<WorkspaceMcpElicitationFieldType>([
  'text',
  'textarea',
  'select',
  'checkbox',
  'number',
]);

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
      const type = readElicitationFieldType(record.type);
      const options = normalizeFieldOptions(record.options);
      const defaultValue = readString(record.defaultValue);
      return {
        id,
        label,
        ...(typeof record.required === 'boolean' ? { required: record.required } : {}),
        ...(readString(record.placeholder) ? { placeholder: readString(record.placeholder) } : {}),
        ...(type ? { type } : {}),
        ...(options.length ? { options } : {}),
        ...(defaultValue ? { defaultValue } : {}),
      };
    })
    .filter((field): field is WorkspaceMcpElicitationField => Boolean(field));
  return fields.length ? fields : DEFAULT_ELICITATION_FIELDS;
}

function readElicitationFieldType(value: unknown): WorkspaceMcpElicitationFieldType | undefined {
  return typeof value === 'string' && ELICITATION_FIELD_TYPES.has(value as WorkspaceMcpElicitationFieldType)
    ? value as WorkspaceMcpElicitationFieldType
    : undefined;
}

function normalizeFieldOptions(value: unknown): WorkspaceMcpElicitationOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((option): WorkspaceMcpElicitationOption | null => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
      const record = option as Record<string, unknown>;
      const label = readString(record.label);
      const optionValue = readString(record.value);
      return label && optionValue ? { label, value: optionValue } : null;
    })
    .filter((option): option is WorkspaceMcpElicitationOption => Boolean(option));
}

export function registerUserContextTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    getUserContextMemory,
    getBrowserLocation,
    onElicitUserInput,
    onRequestSecret,
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
              type: { type: 'string', enum: ['text', 'textarea', 'select', 'checkbox', 'number'] },
              defaultValue: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                  },
                  required: ['label', 'value'],
                  additionalProperties: false,
                },
              },
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

  modelContext.registerTool({
    name: 'request_secret',
    title: 'Request secret',
    description: 'Pause execution and show an inline MCP app form that stores a named secret locally and returns only a secretRef, never the raw secret value.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        prompt: { type: 'string' },
        reason: { type: 'string' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as SecretRequestInput;
      const name = readString(typedInput.name) ?? 'API_KEY';
      const prompt = readString(typedInput.prompt) ?? `Create a secret named ${name}.`;
      const request: WorkspaceMcpSecretRequest = {
        name,
        prompt,
        reason: readString(typedInput.reason),
      };
      if (!onRequestSecret) {
        return {
          status: 'needs_secret' as const,
          requestId: `secret-${Date.now().toString(36)}`,
          name,
          prompt,
        };
      }
      return onRequestSecret(request);
    },
  }, { signal });
}
