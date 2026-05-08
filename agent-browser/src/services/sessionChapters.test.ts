import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  DEFAULT_SESSION_CHAPTER_STATE,
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
    expect(session?.chapters[0]?.compressedContext.summary).toContain('Found a failing checkout test');
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
});
