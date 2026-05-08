import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  DEFAULT_SESSION_CHAPTER_STATE,
  buildContextManagedMessages,
  buildContextManagedTranscriptItems,
  buildContextManagerSnapshot,
  buildSessionCompressionPromptContext,
  isChapteredSessionState,
  projectSessionChapters,
  updateSessionChapterPolicy,
} from './sessionChapters';

const messages: ChatMessage[] = [
  {
    id: 'system-1',
    role: 'system',
    status: 'complete',
    content: 'Agent Browser ready.',
  },
  {
    id: 'user-1',
    role: 'user',
    status: 'complete',
    content: 'Research the checkout bug and keep browser evidence.',
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    status: 'complete',
    content: 'Found a failing checkout test and captured browser evidence.',
    cards: [{ app: 'Browser evidence', args: { screenshot: 'output/playwright/checkout.png' } }],
    processEntries: [
      {
        id: 'proc-1',
        position: 0,
        ts: 100,
        kind: 'tool-call',
        actor: 'playwright',
        summary: 'Capture checkout screenshot',
        transcript: 'Screenshot saved to output/playwright/checkout.png',
        status: 'done',
      },
      {
        id: 'proc-2',
        position: 1,
        ts: 200,
        kind: 'result',
        actor: 'vitest',
        summary: 'Validation failed in Checkout.test.tsx',
        transcript: 'Expected enabled button.',
        status: 'failed',
      },
    ],
  },
  {
    id: 'user-2',
    role: 'user',
    status: 'complete',
    content: 'Patch the button state and rerun validation.',
  },
  {
    id: 'assistant-2',
    role: 'assistant',
    status: 'complete',
    content: 'Patched disabled state and validation passed.',
    processEntries: [
      {
        id: 'proc-3',
        position: 2,
        ts: 300,
        kind: 'result',
        actor: 'vitest',
        summary: 'Validation passed in Checkout.test.tsx',
        transcript: '1 test passed.',
        status: 'done',
      },
    ],
  },
];

describe('sessionChapters', () => {
  it('validates default and persisted chapter state', () => {
    expect(isChapteredSessionState(DEFAULT_SESSION_CHAPTER_STATE)).toBe(true);
    expect(isChapteredSessionState({ enabled: true })).toBe(false);
    expect(isChapteredSessionState({
      ...DEFAULT_SESSION_CHAPTER_STATE,
      policy: { ...DEFAULT_SESSION_CHAPTER_STATE.policy, targetTokenBudget: -1 },
    })).toBe(false);
  });

  it('projects chat messages into inspectable chapters with evidence and validation refs', () => {
    const projected = projectSessionChapters({
      state: DEFAULT_SESSION_CHAPTER_STATE,
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      messages,
      now: '2026-05-08T04:00:00.000Z',
    });

    const session = projected.sessions['session-checkout'];
    expect(session?.chapters).toHaveLength(2);
    expect(session?.chapters[0]).toMatchObject({
      title: 'Chapter 1: Research the checkout bug and keep browser evidence.',
      messageIds: ['user-1', 'assistant-1'],
      sourceTraceRefs: ['message:user-1', 'message:assistant-1', 'process:proc-1', 'process:proc-2'],
      evidenceRefs: ['evidence:output/playwright/checkout.png'],
      validationRefs: [
        'validation:proc-1:Capture checkout screenshot',
        'validation:proc-2:Validation failed in Checkout.test.tsx',
      ],
    });
    expect(session?.chapters[0]?.compressedContext.summary).toContain('checkout');
    expect(projected.audit[0]?.summary).toContain('Projected 2 chapters');
  });

  it('builds compressed prompt context that preserves source trace and evidence handles', () => {
    const projected = projectSessionChapters({
      state: DEFAULT_SESSION_CHAPTER_STATE,
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      messages,
      now: '2026-05-08T04:00:00.000Z',
    });

    const context = buildSessionCompressionPromptContext(projected, 'session-checkout');

    expect(context).toContain('## Chaptered Session Context');
    expect(context).toContain('Chapter 1: Research the checkout bug');
    expect(context).toContain('evidence:output/playwright/checkout.png');
    expect(context).toContain('validation:proc-2:Validation failed in Checkout.test.tsx');
    expect(context).toContain('Instruction: use compressed context for continuity');
  });

  it('allows policy updates while keeping bounded safe values', () => {
    const next = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
      automaticCompression: false,
      targetTokenBudget: 200,
      retainRecentMessageCount: 0,
    });

    expect(next.policy.automaticCompression).toBe(false);
    expect(next.policy.targetTokenBudget).toBe(512);
    expect(next.policy.retainRecentMessageCount).toBe(1);
  });

  it('builds managed model messages from compressed summaries while preserving originals', () => {
    const state = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
      compressAfterMessageCount: 2,
      retainRecentMessageCount: 1,
      renderCompressedMessages: true,
    });
    const projected = projectSessionChapters({
      state,
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      messages,
      now: '2026-05-08T04:00:00.000Z',
    });

    const managedMessages = buildContextManagedMessages({
      state: projected,
      sessionId: 'session-checkout',
      messages,
    });
    const managedTranscript = managedMessages.map((message) => message.content).join('\n');

    expect(managedTranscript).toContain('Context summary for Chapter 1');
    expect(managedTranscript).not.toContain('Research the checkout bug and keep browser evidence.');
    expect(managedTranscript).not.toContain('Found a failing checkout test and captured browser evidence.');
    expect(messages.find((message) => message.id === 'assistant-1')?.content).toContain('Found a failing checkout test');
    expect(managedMessages.at(-1)?.id).toBe('assistant-2');
  });

  it('returns collapsed transcript summary items with expandable original messages', () => {
    const state = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
      compressAfterMessageCount: 2,
      retainRecentMessageCount: 1,
      renderCompressedMessages: true,
    });
    const projected = projectSessionChapters({
      state,
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      messages,
      now: '2026-05-08T04:00:00.000Z',
    });

    const items = buildContextManagedTranscriptItems({
      state: projected,
      sessionId: 'session-checkout',
      messages,
    });

    expect(items[1]).toMatchObject({
      kind: 'chapter-summary',
      chapterId: 'chapter:session-checkout:1',
      originalMessageIds: ['user-1', 'assistant-1'],
    });
    expect(items.some((item) => item.kind === 'message' && item.message.id === 'assistant-1')).toBe(false);
    expect(items.some((item) => item.kind === 'message' && item.message.id === 'assistant-2')).toBe(true);
  });

  it('monitors token usage and reports savings from context management', () => {
    const noisyMessages = messages.map((message) => (
      message.id === 'assistant-1'
        ? {
          ...message,
          processEntries: (message.processEntries ?? []).map((entry) => (
            entry.id === 'proc-1'
              ? {
                ...entry,
                transcript: `${entry.transcript}\n${Array.from({ length: 80 }, (_, index) => `TRACE_${index}: checkout validation detail`).join('\n')}`,
              }
              : entry
          )),
        }
        : message
    ));
    const state = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
      compressAfterMessageCount: 2,
      retainRecentMessageCount: 1,
      renderCompressedMessages: true,
      targetTokenBudget: 512,
    });
    const projected = projectSessionChapters({
      state,
      sessionId: 'session-checkout',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      messages: noisyMessages,
      now: '2026-05-08T04:00:00.000Z',
    });

    const snapshot = buildContextManagerSnapshot({
      state: projected,
      sessionId: 'session-checkout',
      messages: noisyMessages,
      contextWindow: 900,
      maxOutputTokens: 80,
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.originalTokenEstimate).toBeGreaterThan(snapshot.managedTokenEstimate);
    expect(snapshot.droppedOriginalMessageCount).toBe(2);
    expect(snapshot.latestSummary).toContain('patched');
  });

  it('adds caveman mode and tool-output cache refs without inlining large raw outputs', () => {
    const longToolOutput = Array.from({ length: 260 }, (_, index) => `LOG_LINE_${index}: expensive trace payload`).join('\n');
    const largeOutputMessages: ChatMessage[] = [
      ...messages,
      {
        id: 'assistant-large-tool',
        role: 'assistant',
        status: 'complete',
        content: 'Captured a large test log and continued with a summary.',
        processEntries: [
          {
            id: 'proc-large-log',
            position: 3,
            ts: 400,
            kind: 'result',
            actor: 'npm',
            summary: 'Large verification log',
            transcript: longToolOutput,
            status: 'done',
          },
        ],
      },
    ];
    const state = updateSessionChapterPolicy(DEFAULT_SESSION_CHAPTER_STATE, {
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
      messages: largeOutputMessages,
      now: '2026-05-08T04:00:00.000Z',
    });
    const promptContext = buildSessionCompressionPromptContext(projected, 'session-checkout');

    expect(projected.toolOutputCache['tool-output:proc-large-log']).toMatchObject({
      storage: 'file',
      path: '.agent-browser/context-cache/session-checkout/proc-large-log.txt',
    });
    expect(promptContext).toContain('Context manager mode: caveman');
    expect(promptContext).toContain('tool-output:proc-large-log');
    expect(promptContext).toContain('.agent-browser/context-cache/session-checkout/proc-large-log.txt');
    expect(promptContext).not.toContain('LOG_LINE_259');
  });
});
