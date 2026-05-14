import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterSessionToolsOptions,
  WorkspaceMcpRoutingConfig,
  WorkspaceMcpRoutingTelemetryEvent,
} from './workspaceToolTypes';
import {
  applySessionMutation,
  applySessionToolChange,
  filterSessionTools,
  toSessionStateResult,
} from './workspaceToolShared';

type SessionInput = {
  sessionId?: string;
};

type SessionMessageInput = SessionInput & {
  message?: string;
};

type SessionModelInput = SessionInput & {
  provider?: string;
  modelId?: string;
};

type SessionModeInput = SessionInput & {
  mode?: string;
};



type SessionRoutingInput = SessionInput & {
  scope?: 'global' | 'project' | 'session';
  routing?: WorkspaceMcpRoutingConfig;
};

type SessionRoutingTelemetryInput = SessionInput & {
  policyId?: string;
  selectedProvider?: string;
  selectedModel?: string;
  score?: number;
  confidence?: number;
  reasonVector?: unknown;
  estimatedCostDeltaUsd?: number;
  estimatedCostDeltaPct?: number;
};

function validateRoutingConfig(value: unknown): WorkspaceMcpRoutingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('routing must be an object.');
  const routing = value as WorkspaceMcpRoutingConfig;
  if (typeof routing.enabled !== 'boolean') throw new TypeError('routing.enabled must be boolean.');
  if (routing.mode && routing.mode !== 'shadow' && routing.mode !== 'enforce') throw new TypeError('routing.mode must be shadow or enforce.');
  if (routing.escalationKeywords && (!Array.isArray(routing.escalationKeywords) || !routing.escalationKeywords.every((v) => typeof v === 'string'))) throw new TypeError('routing.escalationKeywords must be a string array.');
  return routing;
}

function parseRoutingTelemetryEvent(input: SessionRoutingTelemetryInput): WorkspaceMcpRoutingTelemetryEvent {
  if (!input.selectedProvider || !input.selectedModel) throw new TypeError('selectedProvider and selectedModel are required.');
  if (!Array.isArray(input.reasonVector) || !input.reasonVector.every((v) => typeof v === 'string')) throw new TypeError('reasonVector must be a string array.');
  const score = Number(input.score);
  const confidence = Number(input.confidence);
  if (!Number.isFinite(score) || !Number.isFinite(confidence)) throw new TypeError('score and confidence must be finite numbers.');
  return {
    timestamp: new Date().toISOString(),
    policyId: input.policyId?.trim() || null,
    selectedProvider: input.selectedProvider,
    selectedModel: input.selectedModel,
    score,
    confidence,
    reasonVector: input.reasonVector,
    estimatedCostDeltaUsd: Number.isFinite(input.estimatedCostDeltaUsd) ? input.estimatedCostDeltaUsd : null,
    estimatedCostDeltaPct: Number.isFinite(input.estimatedCostDeltaPct) ? input.estimatedCostDeltaPct : null,
  };
}

type SessionToolsInput = SessionInput & {
  query?: string;
  action?: string;
  toolIds?: unknown;
};

export function registerSessionTools(modelContext: ModelContext, options: RegisterSessionToolsOptions): void {
  const { workspaceName, session, sessionTools = [], onWriteSession, signal } = options;

  const requireActiveSession = (input: SessionInput) => {
    const requestedSessionId = typeof input.sessionId === 'string' && input.sessionId.trim()
      ? input.sessionId.trim()
      : session.id;
    if (requestedSessionId !== session.id) {
      throw new DOMException(`Session "${requestedSessionId}" is not the active session. Open it first before reading.`, 'NotFoundError');
    }

    return requestedSessionId;
  };

  modelContext.registerTool({
    name: 'read_session',
    title: 'Read session',
    description: `Read the active session in ${workspaceName}.`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      requireActiveSession(input as SessionInput);
      return toSessionStateResult(workspaceName, session);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  if (sessionTools.length > 0) {
    modelContext.registerTool({
      name: 'list_session_tools',
      title: 'List session tools',
      description: `List or search tools available to the active session in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          query: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        requireActiveSession(input as SessionInput);
        return filterSessionTools(sessionTools, session.toolIds ?? [], (input as SessionToolsInput).query);
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onWriteSession) {
    modelContext.registerTool({
      name: 'submit_session_message',
      title: 'Submit session message',
      description: `Submit a chat message through the active session input control in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionMessageInput;
        const sessionId = requireActiveSession(typedInput);
        const message = typeof typedInput.message === 'string' && typedInput.message.trim()
          ? typedInput.message
          : null;
        if (!message) {
          throw new TypeError('submit_session_message requires a non-empty message.');
        }

        return applySessionMutation(workspaceName, session, { sessionId, message }, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'change_session_model',
      title: 'Change session model',
      description: `Change the active model for the active session in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          provider: { type: 'string' },
          modelId: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionModelInput;
        const sessionId = requireActiveSession(typedInput);
        const modelId = typeof typedInput.modelId === 'string' ? typedInput.modelId.trim() : '';
        if (!modelId) {
          throw new TypeError('change_session_model requires a modelId.');
        }

        const provider = typeof typedInput.provider === 'string' && typedInput.provider.trim()
          ? typedInput.provider.trim()
          : undefined;
        return applySessionMutation(workspaceName, session, {
          sessionId,
          ...(provider ? { provider } : {}),
          modelId,
        }, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'switch_session_mode',
      title: 'Switch session mode',
      description: `Switch the active session between agent chat mode and terminal mode in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          mode: { type: 'string', enum: ['agent', 'terminal'] },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionModeInput;
        const sessionId = requireActiveSession(typedInput);
        if (typedInput.mode !== 'agent' && typedInput.mode !== 'terminal') {
          throw new TypeError('switch_session_mode requires mode to be "agent" or "terminal".');
        }

        return applySessionMutation(workspaceName, session, { sessionId, mode: typedInput.mode }, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'change_session_routing',
      title: 'Change session routing',
      description: `Configure routing policy and model thresholds for the active session in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          scope: { type: 'string', enum: ['global', 'project', 'session'] },
          routing: { type: 'object' },
        },
        required: ['routing'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionRoutingInput;
        const sessionId = requireActiveSession(typedInput);
        const routing = validateRoutingConfig(typedInput.routing);
        return applySessionMutation(workspaceName, session, { sessionId, routingScope: typedInput.scope ?? 'session', routing }, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'record_session_routing_decision',
      title: 'Record session routing decision',
      description: `Emit routing telemetry decision details for the active session in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          policyId: { type: 'string' },
          selectedProvider: { type: 'string' },
          selectedModel: { type: 'string' },
          score: { type: 'number' },
          confidence: { type: 'number' },
          reasonVector: { type: 'array', items: { type: 'string' } },
          estimatedCostDeltaUsd: { type: 'number' },
          estimatedCostDeltaPct: { type: 'number' },
        },
        required: ['selectedProvider', 'selectedModel', 'score', 'confidence', 'reasonVector'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionRoutingTelemetryInput;
        const sessionId = requireActiveSession(typedInput);
        const routingTelemetryEvent = parseRoutingTelemetryEvent(typedInput);
        return applySessionMutation(workspaceName, session, { sessionId, routingTelemetryEvent }, onWriteSession);
      },
    }, { signal });

    if (sessionTools.length > 0) {
      modelContext.registerTool({
        name: 'change_session_tools',
        title: 'Change session tools',
        description: `Select or deselect tools active in the active session in ${workspaceName}.`,
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            action: { type: 'string', enum: ['select', 'deselect'] },
            toolIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        execute: async (input: object) => {
          const typedInput = input as SessionToolsInput;
          const sessionId = requireActiveSession(typedInput);
          const toolIds = applySessionToolChange(sessionTools, session.toolIds ?? [], typedInput.action, typedInput.toolIds);
          return applySessionMutation(workspaceName, session, { sessionId, toolIds }, onWriteSession);
        },
      }, { signal });
    }
  }
}
