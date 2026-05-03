import type { ReasoningStep, ReasoningStepKind, SourceChip } from '../types';

export interface CodexModelSummary {
  id: string;
  name: string;
  reasoning: boolean;
  vision: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface CodexRuntimeState {
  available: boolean;
  authenticated: boolean;
  version?: string;
  statusMessage?: string;
  error?: string;
  models: CodexModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}

export interface CodexChatRequest {
  modelId: string;
  prompt: string;
  sessionId: string;
}

export interface CodexChatCallbacks {
  onToken?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onReasoningStep?: (step: ReasoningStep) => void;
  onReasoningStepUpdate?: (id: string, patch: Partial<ReasoningStep>) => void;
  onReasoningStepEnd?: (id: string) => void;
  onDone?: (finalContent?: string) => void;
}

type CodexStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'reasoning_step'; id?: string; kind?: ReasoningStepKind; title: string; body?: string; status?: 'active' | 'done'; sources?: SourceChip[] }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

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

export async function fetchCodexState(signal?: AbortSignal): Promise<CodexRuntimeState> {
  const response = await fetch('/api/codex/status', { signal });
  if (!response.ok) {
    throw createHttpError(await readErrorMessage(response, 'Failed to check Codex status.'), response.status);
  }
  return response.json() as Promise<CodexRuntimeState>;
}

export async function streamCodexRuntimeChat(request: CodexChatRequest, callbacks: CodexChatCallbacks, signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/codex/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw createHttpError(await readErrorMessage(response, 'Codex request failed.'), response.status);
  }

  if (!response.body) {
    throw new Error('Codex did not return a readable response stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalContent: string | undefined;
  let completed = false;

  const handleEvent = (event: CodexStreamEvent) => {
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
          sources: event.sources,
          startedAt: Date.now(),
          status: event.status ?? 'active',
        });
        if (event.status === 'done' && event.id) callbacks.onReasoningStepEnd?.(event.id);
        break;
      case 'final':
        finalContent = event.content;
        break;
      case 'done':
        completed = true;
        callbacks.onDone?.(finalContent);
        break;
      case 'error':
        throw new Error(event.message || 'Codex request failed.');
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
          handleEvent(JSON.parse(line) as CodexStreamEvent);
        }
        newlineIndex = buffer.indexOf('\n');
      }

      if (done) {
        const trailing = buffer.trim();
        if (trailing) {
          handleEvent(JSON.parse(trailing) as CodexStreamEvent);
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
