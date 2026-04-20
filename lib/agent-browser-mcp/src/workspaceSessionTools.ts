import { ModelContext } from '../../webmcp/src/index';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpWriteSessionInput,
} from './workspaceToolTypes';
import {
  applySessionMutation,
  applySessionToolChange,
  filterSessionTools,
  readOpenSessionState,
  normalizeSessionMutationResult,
  resolveSessionSummaryInput,
  toSessionStateResult,
  toSessionSummary,
} from './workspaceToolShared';

type SessionInput = {
  sessionId?: string;
};

type SessionMessageInput = SessionInput & {
  message?: string;
};

type SessionAgentInput = SessionInput & {
  agentId?: string;
};

type SessionModelInput = SessionInput & {
  provider?: string;
  modelId?: string;
};

type SessionModeInput = SessionInput & {
  mode?: string;
};

type SessionToolsInput = SessionInput & {
  query?: string;
  action?: string;
  toolIds?: unknown;
};

export function registerWorkspaceSessionTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    workspaceName,
    sessions = [],
    sessionTools = [],
    getSessionTools,
    getSessionState,
    onCreateSession,
    onWriteSession,
    signal,
  } = options;

  const readAvailableSessionTools = () => getSessionTools?.() ?? sessionTools;

  const hasSessionTools = sessions.length > 0 || onCreateSession || onWriteSession || readAvailableSessionTools().length > 0;
  if (!hasSessionTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_sessions',
    title: 'List sessions',
    description: 'List sessions available in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => sessions.map(toSessionSummary),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onCreateSession) {
    modelContext.registerTool({
      name: 'create_session',
      title: 'Create session',
      description: 'Create a session in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const name = typeof (input as { name?: string }).name === 'string'
          ? (input as { name?: string }).name?.trim() || undefined
          : undefined;
        const result = await onCreateSession({ name });
        return normalizeSessionMutationResult('create', '', result);
      },
    }, { signal });
  }

  if (getSessionState) {
    modelContext.registerTool({
      name: 'read_session',
      title: 'Read session',
      description: 'Read an open session from the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => toSessionStateResult(
        workspaceName,
        readOpenSessionState(sessions, getSessionState, input as SessionInput),
      ),
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (getSessionState && readAvailableSessionTools().length > 0) {
    modelContext.registerTool({
      name: 'list_session_tools',
      title: 'List session tools',
      description: 'List or search tools available to the active session in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          query: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const session = resolveSessionSummaryInput(sessions, input as SessionInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        const typedInput = input as SessionToolsInput;
        return filterSessionTools(readAvailableSessionTools(), currentState.toolIds ?? [], typedInput.query);
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onWriteSession && getSessionState) {
    modelContext.registerTool({
      name: 'submit_session_message',
      title: 'Submit session message',
      description: 'Submit a chat message through the active session input control.',
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
        const session = resolveSessionSummaryInput(sessions, typedInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        const message = typeof typedInput.message === 'string' && typedInput.message.trim()
          ? typedInput.message
          : null;
        if (!message) {
          throw new TypeError('submit_session_message requires a non-empty message.');
        }

        const update: WorkspaceMcpWriteSessionInput = {
          sessionId: session.id,
          message,
        };
        return applySessionMutation(workspaceName, currentState, update, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'change_session_agent',
      title: 'Change session agent',
      description: 'Change the active AGENTS.md selection for an open session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          agentId: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionAgentInput;
        const session = resolveSessionSummaryInput(sessions, typedInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        const agentId = typeof typedInput.agentId === 'string' ? typedInput.agentId.trim() : '';
        if (!agentId) {
          throw new TypeError('change_session_agent requires an agentId.');
        }

        const update: WorkspaceMcpWriteSessionInput = {
          sessionId: session.id,
          agentId,
        };
        return applySessionMutation(workspaceName, currentState, update, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'change_session_model',
      title: 'Change session model',
      description: 'Change the active model for an open session.',
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
        const session = resolveSessionSummaryInput(sessions, typedInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        const modelId = typeof typedInput.modelId === 'string' ? typedInput.modelId.trim() : '';
        if (!modelId) {
          throw new TypeError('change_session_model requires a modelId.');
        }

        const provider = typeof typedInput.provider === 'string' && typedInput.provider.trim()
          ? typedInput.provider.trim()
          : undefined;
        const update: WorkspaceMcpWriteSessionInput = {
          sessionId: session.id,
          ...(provider ? { provider } : {}),
          modelId,
        };
        return applySessionMutation(workspaceName, currentState, update, onWriteSession);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'switch_session_mode',
      title: 'Switch session mode',
      description: 'Switch an open session between agent chat mode and terminal mode.',
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
        const session = resolveSessionSummaryInput(sessions, typedInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        if (typedInput.mode !== 'agent' && typedInput.mode !== 'terminal') {
          throw new TypeError('switch_session_mode requires mode to be "agent" or "terminal".');
        }

        const update: WorkspaceMcpWriteSessionInput = {
          sessionId: session.id,
          mode: typedInput.mode,
        };
        return applySessionMutation(workspaceName, currentState, update, onWriteSession);
      },
    }, { signal });

    if (readAvailableSessionTools().length > 0) {
      modelContext.registerTool({
        name: 'change_session_tools',
        title: 'Change session tools',
        description: 'Select or deselect tools active in an open session.',
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
          const session = resolveSessionSummaryInput(sessions, typedInput);
          const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
          const nextToolIds = applySessionToolChange(
            readAvailableSessionTools(),
            currentState.toolIds ?? [],
            typedInput.action,
            typedInput.toolIds,
          );

          const update: WorkspaceMcpWriteSessionInput = {
            sessionId: session.id,
            toolIds: nextToolIds,
          };
          return applySessionMutation(workspaceName, currentState, update, onWriteSession);
        },
      }, { signal });
    }
  }
}