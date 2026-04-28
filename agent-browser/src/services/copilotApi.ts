import type { ReasoningStep, ReasoningStepKind, SourceChip } from '../types';
import { normalizeHostname } from '../utils/favicon';

export type AgentProvider = 'copilot' | 'local';

export interface CopilotModelSummary {
  id: string;
  name: string;
  policyState?: string;
  reasoning: boolean;
  vision: boolean;
  billingMultiplier?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface CopilotRuntimeState {
  available: boolean;
  authenticated: boolean;
  authType?: string;
  host?: string;
  login?: string;
  statusMessage?: string;
  error?: string;
  models: CopilotModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}

export interface CopilotChatRequest {
  modelId: string;
  prompt: string;
  sessionId: string;
}

export interface CopilotChatCallbacks {
  onToken?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onReasoningStep?: (step: ReasoningStep) => void;
  onReasoningStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;
  onReasoningStepEnd?: (id: string) => void;
  onDone?: (finalContent?: string) => void;
}

type CopilotStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'reasoning_step'; id?: string; kind?: ReasoningStepKind; title: string; body?: string; status?: 'active' | 'done'; sources?: Array<string | SourceChip> }
  | { type: 'tool_call_start'; id?: string; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_call_end'; id?: string }
  | { type: 'search'; id?: string; title?: string; query?: string; status?: 'active' | 'done'; sources?: Array<string | SourceChip> }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

function normalizeSourceChip(source: string | SourceChip): SourceChip {
  if (typeof source !== 'string') {
    // Do not trust remote favicon urls from model/tool output. The UI renders
    // source identity locally from the normalized domain instead.
    return {
      domain: source.domain,
      url: source.url,
    };
  }

  const hostname = normalizeHostname(source);
  if (hostname) {
    return {
      url: source.startsWith('http') ? source : `https://${source}`,
      domain: hostname,
    };
  }
  return { domain: source };
}

function summarizeToolArgs(args?: Record<string, unknown>): string | undefined {
  if (!args) return undefined;
  const entries = Object.entries(args);
  if (!entries.length) return undefined;
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
}

function createHttpError(message: string, status?: number) {
  const error = new Error(message);
  if (typeof status === 'number') {
    Object.assign(error, { status });
  }
  return error;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCopilotState(signal?: AbortSignal): Promise<CopilotRuntimeState> {
  const response = await fetch('/api/copilot/status', { signal });
  if (!response.ok) {
    throw createHttpError(await readErrorMessage(response, 'Failed to check GitHub Copilot status.'), response.status);
  }
  return response.json() as Promise<CopilotRuntimeState>;
}

export async function streamCopilotChat(request: CopilotChatRequest, callbacks: CopilotChatCallbacks, signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw createHttpError(await readErrorMessage(response, 'GitHub Copilot request failed.'), response.status);
  }

  if (!response.body) {
    throw new Error('GitHub Copilot did not return a readable response stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalContent: string | undefined;
  let completed = false;

  const handleEvent = (event: CopilotStreamEvent) => {
    switch (event.type) {
      case 'token':
        callbacks.onToken?.(event.delta);
        break;
      case 'reasoning':
        callbacks.onReasoning?.(event.delta);
        break;
      case 'reasoning_step':
        callbacks.onReasoningStep?.({
          id: event.id ?? `reasoning-${Math.random().toString(36).slice(2, 10)}`,
          kind: event.kind ?? 'thinking',
          title: event.title,
          body: event.body,
          sources: event.sources?.map(normalizeSourceChip),
          startedAt: Date.now(),
          status: event.status ?? 'active',
        });
        if (event.status === 'done' && event.id) callbacks.onReasoningStepEnd?.(event.id);
        break;
      case 'tool_call_start': {
        const toolStepId = event.id ?? `tool-${Math.random().toString(36).slice(2, 10)}`;
        callbacks.onReasoningStep?.({
          id: toolStepId,
          kind: 'tool',
          title: event.tool,
          body: summarizeToolArgs(event.args),
          startedAt: Date.now(),
          status: 'active',
        });
        break;
      }
      case 'tool_call_end':
        if (event.id) {
          callbacks.onReasoningStepUpdate?.(event.id, { endedAt: Date.now(), status: 'done' });
          callbacks.onReasoningStepEnd?.(event.id);
        }
        break;
      case 'search': {
        const searchStepId = event.id ?? `search-${Math.random().toString(36).slice(2, 10)}`;
        const searchTitle = event.title ?? event.query ?? 'Searching';
        callbacks.onReasoningStep?.({
          id: searchStepId,
          kind: 'search',
          title: searchTitle,
          sources: event.sources?.map(normalizeSourceChip),
          startedAt: Date.now(),
          status: event.status ?? 'active',
        });
        if (event.status === 'done') callbacks.onReasoningStepEnd?.(searchStepId);
        break;
      }
      case 'final':
        finalContent = event.content;
        break;
      case 'done':
        completed = true;
        callbacks.onDone?.(finalContent);
        break;
      case 'error':
        throw new Error(event.message || 'GitHub Copilot request failed.');
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          handleEvent(JSON.parse(line) as CopilotStreamEvent);
        }
        newlineIndex = buffer.indexOf('\n');
      }

      if (done) {
        const trailing = buffer.trim();
        if (trailing) {
          handleEvent(JSON.parse(trailing) as CopilotStreamEvent);
        }
        if (!completed) {
          callbacks.onDone?.(finalContent);
        }
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
