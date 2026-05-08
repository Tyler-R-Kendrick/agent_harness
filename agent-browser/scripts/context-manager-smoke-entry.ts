import assert from 'node:assert/strict';
import {
  DEFAULT_SESSION_CHAPTER_STATE,
  buildContextManagedMessages,
  buildContextManagedTranscriptItems,
  buildContextManagerSnapshot,
  buildSessionCompressionPromptContext,
  projectSessionChapters,
  updateSessionChapterPolicy,
} from '../src/services/sessionChapters';
import {
  CONTEXT_MANAGER_AGENT_ID,
  CONTEXT_MANAGER_LABEL,
  buildContextManagerOperatingInstructions,
  buildContextManagerSystemPrompt,
  buildContextManagerToolInstructions,
  isContextManagerTaskText,
} from '../src/chat-agents/ContextManager/prompt';
import type { ChatMessage } from '../src/types';

const messages: ChatMessage[] = [
  { id: 'system-1', role: 'system', status: 'complete', content: 'Agent Browser ready.' },
  { id: 'user-1', role: 'user', status: 'complete', content: 'Research the checkout bug and keep browser evidence.' },
  {
    id: 'assistant-1',
    role: 'assistant',
    status: 'complete',
    content: 'Found a failing checkout test and captured browser evidence.',
    cards: [{ app: 'Browser evidence', args: { screenshot: 'output/playwright/checkout.png' } }],
    processEntries: [
      {
        id: 'proc-large-log',
        position: 0,
        ts: 100,
        kind: 'result',
        actor: 'npm',
        summary: 'Large verification log',
        transcript: Array.from({ length: 260 }, (_, index) => `LOG_LINE_${index}: expensive trace payload`).join('\n'),
        status: 'done',
      },
    ],
  },
  { id: 'user-2', role: 'user', status: 'complete', content: 'Patch the button state and rerun validation.' },
  { id: 'assistant-2', role: 'assistant', status: 'complete', content: 'Patched disabled state and validation passed.' },
];

const state = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
  compressAfterMessageCount: 2,
  retainRecentMessageCount: 2,
  renderCompressedMessages: true,
  contextMode: 'caveman',
  toolOutputCache: {
    ...DEFAULT_SESSION_CHAPTER_STATE.policy.toolOutputCache,
    inlineTokenLimit: 20,
    fileTokenThreshold: 50,
  },
});
const projected = projectSessionChapters({
  state,
  sessionId: 'session-checkout',
  workspaceId: 'ws-research',
  workspaceName: 'Research',
  messages,
  now: '2026-05-08T04:00:00.000Z',
});
const managedMessages = buildContextManagedMessages({ state: projected, sessionId: 'session-checkout', messages });
const transcriptItems = buildContextManagedTranscriptItems({ state: projected, sessionId: 'session-checkout', messages });
const snapshot = buildContextManagerSnapshot({ state: projected, sessionId: 'session-checkout', messages });
const promptContext = buildSessionCompressionPromptContext(projected, 'session-checkout');

assert.equal(CONTEXT_MANAGER_AGENT_ID, 'context-manager');
assert.equal(CONTEXT_MANAGER_LABEL, 'Context Manager');
assert.equal(isContextManagerTaskText('Monitor token usage and compact chat context.'), true);
assert.equal(isContextManagerTaskText('Say hello.'), false);
assert.match(buildContextManagerOperatingInstructions(), /tool-output cache refs/);
assert.match(buildContextManagerSystemPrompt({ workspaceName: 'Research', modelId: 'gpt-4.1' }), /Context Manager Operating Instructions/);
assert.match(buildContextManagerToolInstructions({
  workspaceName: 'Research',
  workspacePromptContext: '## Chaptered Session Context',
  descriptors: [{ id: 'browser.open', label: 'Open', description: 'Open a URL' }],
  selectedToolIds: ['browser.open'],
}), /browser\.open/);
assert.match(managedMessages.map((message) => message.content).join('\n'), /Context summary for Chapter 1/);
assert.equal(transcriptItems.some((item) => item.kind === 'chapter-summary' && item.originalMessageIds.includes('assistant-1')), true);
assert.equal(snapshot.droppedOriginalMessageCount, 2);
assert.equal(projected.toolOutputCache['tool-output:proc-large-log'].storage, 'file');
assert.match(promptContext, /Context manager mode: caveman/);
assert.match(promptContext, /tool-output:proc-large-log/);
assert.doesNotMatch(promptContext, /LOG_LINE_259/);

console.log('context-manager smoke passed');
