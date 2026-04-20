import { streamCopilotChat, type CopilotModelSummary, type CopilotRuntimeState } from '../../services/copilotApi';
import { toChatSdkTranscript } from '../../services/chatComposition';
import type { ChatMessage } from '../../types';
import { createReasoningStepSplitter } from '../reasoningSplitter';
import type { AgentStreamCallbacks } from '../types';

export const GHCP_LABEL = 'GHCP';

export function hasGhcpAccess(state: CopilotRuntimeState): boolean {
  return state.available && state.authenticated && state.models.length > 0;
}

export function resolveGhcpModelId(models: CopilotModelSummary[], selectedModelId: string): string {
  return models.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : (models[0]?.id || '');
}

export function buildGhcpPrompt({
  workspaceName,
  workspacePromptContext,
  messages,
  latestUserInput,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  latestUserInput: string;
}): string {
  const transcript = toChatSdkTranscript(messages)
    .filter((message) => message.text.trim())
    .map((message) => `${message.role}: ${message.text}`)
    .join('\n\n');

  return [
    'You are GHCP, a GitHub Copilot-backed agent for an agent-first browser. Be concise and clear.',
    `Active workspace: ${workspaceName}`,
    workspacePromptContext,
    transcript ? `Conversation transcript:\n${transcript}` : null,
    `Latest user request:\n${latestUserInput.trim()}`,
  ].filter(Boolean).join('\n\n');
}

// Pattern matching ###STEP: or ###SEARCH: marker lines emitted by the model
const TOKEN_MARKER_PATTERN = /^###(STEP|SEARCH):\s*.+$/i;

/**
 * Strip reasoning marker lines from a finished content string so that
 * `###STEP:` / `###SEARCH:` tags injected by the model don't appear in the
 * visible chat bubble when a Copilot `final` event is received.
 */
function filterMarkerLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !TOKEN_MARKER_PATTERN.test(line.trim()))
    .join('\n')
    .trim();
}

export async function streamGhcpChat(
  {
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
  }: {
    modelId: string;
    sessionId: string;
    workspaceName: string;
    workspacePromptContext: string;
    messages: ChatMessage[];
    latestUserInput: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // Track whether the server sends structured NDJSON reasoning_step events.
  // If it does, we skip the local splitter (avoid double-counting steps).
  // Splitter-generated steps do NOT set this flag — we always want the splitter
  // to continue processing subsequent onReasoning deltas.
  let sawNdjsonStep = false;
  const reasoningSplitter = createReasoningStepSplitter({
    markers: true,
    onStepStart: (step) => {
      callbacks.onReasoningStep?.(step);
    },
    onStepUpdate: (id, patch) => callbacks.onReasoningStepUpdate?.(id, patch),
    onStepEnd: (id) => callbacks.onReasoningStepEnd?.(id),
  });

  // Buffer incomplete lines so we can detect full marker lines before forwarding tokens.
  let tokenLineBuffer = '';

  const processTokenLine = (line: string, trailingNewline: boolean) => {
    if (TOKEN_MARKER_PATTERN.test(line.trim())) {
      // Route marker lines to the reasoning splitter — don't show in response
      reasoningSplitter.push(line + '\n');
    } else {
      callbacks.onToken?.(trailingNewline ? `${line}\n` : line);
    }
  };

  const filteredOnToken = (delta: string) => {
    const combined = tokenLineBuffer + delta;
    const parts = combined.split('\n');
    tokenLineBuffer = parts.pop() ?? '';
    for (const line of parts) {
      processTokenLine(line, true);
    }
  };

  await streamCopilotChat(
    {
      modelId,
      sessionId,
      prompt: buildGhcpPrompt({ workspaceName, workspacePromptContext, messages, latestUserInput }),
    },
    {
      onToken: filteredOnToken,
      onReasoning: (delta) => {
        // Always feed native reasoning into the splitter UNLESS the server is
        // already sending structured NDJSON reasoning_step events.
        if (!sawNdjsonStep) reasoningSplitter.push(delta);
        callbacks.onReasoning?.(delta);
      },
      onReasoningStep: (step) => {
        // Server sent a structured step — disable the local splitter.
        sawNdjsonStep = true;
        callbacks.onReasoningStep?.(step);
      },
      onReasoningStepUpdate: (id, patch) => callbacks.onReasoningStepUpdate?.(id, patch),
      onReasoningStepEnd: (id) => callbacks.onReasoningStepEnd?.(id),
      onDone: (finalContent) => {
        // Flush the last unsent partial line
        if (tokenLineBuffer) {
          processTokenLine(tokenLineBuffer, false);
          tokenLineBuffer = '';
        }
        if (!sawNdjsonStep) reasoningSplitter.finish();
        // Strip any marker lines from the assembled final content (the server
        // assembles its own full copy from all message deltas).
        const cleanedFinalContent = finalContent ? filterMarkerLines(finalContent) || undefined : undefined;
        callbacks.onDone?.(cleanedFinalContent);
      },
    },
    signal,
  );
}