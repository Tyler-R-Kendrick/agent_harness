export type AgentProvider = 'copilot' | 'local';

export interface CopilotModelSummary {
  id: string;
  name: string;
  policyState?: string;
  reasoning: boolean;
  vision: boolean;
  billingMultiplier?: number;
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
}

export interface CopilotChatCallbacks {
  onToken?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onDone?: (finalContent?: string) => void;
}

type CopilotStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
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