import type { ChatMessage } from '../types';

export interface SessionChapterPolicy {
  automaticCompression: boolean;
  compressAfterMessageCount: number;
  targetTokenBudget: number;
  retainRecentMessageCount: number;
  preserveEvidenceRefs: boolean;
}

export interface CompressedSessionContext {
  summary: string;
  carryForward: string[];
  sourceTraceRefs: string[];
  evidenceRefs: string[];
  validationRefs: string[];
  retainedRecentMessageIds: string[];
  tokenBudget: number;
  createdAt: string;
}

export interface SessionChapter {
  id: string;
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  status: 'active' | 'compressed';
  startedAt: string;
  updatedAt: string;
  messageIds: string[];
  sourceTraceRefs: string[];
  evidenceRefs: string[];
  validationRefs: string[];
  compressedContext: CompressedSessionContext;
}

export interface ChapteredSession {
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  updatedAt: string;
  chapters: SessionChapter[];
}

export interface SessionChapterAuditEntry {
  id: string;
  sessionId: string;
  action: 'projected' | 'policy-updated';
  summary: string;
  createdAt: string;
}

export interface ChapteredSessionState {
  enabled: boolean;
  policy: SessionChapterPolicy;
  sessions: Record<string, ChapteredSession>;
  audit: SessionChapterAuditEntry[];
}

export interface ProjectSessionChaptersInput {
  state: ChapteredSessionState;
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  messages: ChatMessage[];
  now?: string;
}

export const DEFAULT_SESSION_CHAPTER_POLICY: SessionChapterPolicy = {
  automaticCompression: true,
  compressAfterMessageCount: 2,
  targetTokenBudget: 1200,
  retainRecentMessageCount: 4,
  preserveEvidenceRefs: true,
};

export const DEFAULT_SESSION_CHAPTER_STATE: ChapteredSessionState = {
  enabled: true,
  policy: DEFAULT_SESSION_CHAPTER_POLICY,
  sessions: {
    'visual-eval-session': {
      sessionId: 'visual-eval-session',
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      updatedAt: '2026-05-08T04:00:00.000Z',
      chapters: [
        {
          id: 'chapter:visual-eval-session:1',
          sessionId: 'visual-eval-session',
          workspaceId: 'ws-research',
          workspaceName: 'Research',
          title: 'Chapter 1: Visual validation and checkpoint review',
          status: 'compressed',
          startedAt: '2026-05-08T04:00:00.000Z',
          updatedAt: '2026-05-08T04:00:00.000Z',
          messageIds: ['visual-eval-assistant'],
          sourceTraceRefs: ['message:visual-eval-assistant', 'process:visual-tool'],
          evidenceRefs: ['evidence:output/playwright/agent-browser-visual-smoke.png'],
          validationRefs: ['validation:visual-tool:Capture browser screenshot'],
          compressedContext: {
            summary: 'Captured visual smoke evidence and preserved the checkpoint trace for review.',
            carryForward: [
              'Visual validation produced output/playwright/agent-browser-visual-smoke.png.',
              'Resume checkpoints and browser evidence remain linked to the original process trace.',
            ],
            sourceTraceRefs: ['message:visual-eval-assistant', 'process:visual-tool'],
            evidenceRefs: ['evidence:output/playwright/agent-browser-visual-smoke.png'],
            validationRefs: ['validation:visual-tool:Capture browser screenshot'],
            retainedRecentMessageIds: ['visual-eval-assistant'],
            tokenBudget: 1200,
            createdAt: '2026-05-08T04:00:00.000Z',
          },
        },
      ],
    },
  },
  audit: [
    {
      id: 'audit:visual-eval-session:projected',
      sessionId: 'visual-eval-session',
      action: 'projected',
      summary: 'Projected 1 chapter for visual-eval-session.',
      createdAt: '2026-05-08T04:00:00.000Z',
    },
  ],
};

export function projectSessionChapters({
  state,
  sessionId,
  workspaceId,
  workspaceName,
  messages,
  now = new Date().toISOString(),
}: ProjectSessionChaptersInput): ChapteredSessionState {
  const policy = normalizeSessionChapterPolicy(state.policy);
  const transcriptMessages = messages.filter((message) => message.role !== 'system');
  const chapters = buildChapters({
    sessionId,
    workspaceId,
    workspaceName,
    messages: transcriptMessages,
    policy,
    now,
  });
  const session: ChapteredSession = {
    sessionId,
    workspaceId,
    workspaceName,
    updatedAt: now,
    chapters,
  };
  return {
    ...state,
    policy,
    sessions: {
      ...state.sessions,
      [sessionId]: session,
    },
    audit: [
      {
        id: `audit:${sessionId}:projected:${now}`,
        sessionId,
        action: 'projected' as const,
        summary: `Projected ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} for ${sessionId}.`,
        createdAt: now,
      },
      ...state.audit,
    ].slice(0, 20),
  };
}

export function buildSessionCompressionPromptContext(
  state: ChapteredSessionState,
  sessionId: string,
): string {
  if (!state.enabled) return '';
  const session = state.sessions[sessionId];
  if (!session?.chapters.length) return '';
  const chapters = session.chapters.slice(-3);
  return [
    '## Chaptered Session Context',
    `Session: ${session.sessionId}`,
    `Workspace: ${session.workspaceName}`,
    `Compression policy: target ${state.policy.targetTokenBudget} tokens, retain ${state.policy.retainRecentMessageCount} recent messages`,
    ...chapters.flatMap((chapter, index) => [
      `${index + 1}. ${chapter.title}`,
      `Summary: ${chapter.compressedContext.summary}`,
      `Carry forward: ${chapter.compressedContext.carryForward.join(' ')}`,
      `Source trace refs: ${chapter.sourceTraceRefs.join(', ') || 'none'}`,
      `Evidence refs: ${chapter.evidenceRefs.join(', ') || 'none'}`,
      `Validation refs: ${chapter.validationRefs.join(', ') || 'none'}`,
    ]),
    'Instruction: use compressed context for continuity, but cite source trace refs, evidence refs, and validation refs whenever they matter. Do not treat compression as permission to ignore underlying browser evidence.',
  ].join('\n');
}

export function updateSessionChapterPolicy(
  state: ChapteredSessionState,
  patch: Partial<SessionChapterPolicy>,
  now = new Date().toISOString(),
): ChapteredSessionState {
  const policy = normalizeSessionChapterPolicy({ ...state.policy, ...patch });
  return {
    ...state,
    policy,
    audit: [
      {
        id: `audit:session-chapters:policy-updated:${now}`,
        sessionId: '*',
        action: 'policy-updated' as const,
        summary: `Updated chapter compression policy to ${policy.targetTokenBudget} target tokens.`,
        createdAt: now,
      },
      ...state.audit,
    ].slice(0, 20),
  };
}

export function isChapteredSessionState(value: unknown): value is ChapteredSessionState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && isSessionChapterPolicy(value.policy)
    && isRecord(value.sessions)
    && Object.values(value.sessions).every(isChapteredSession)
    && Array.isArray(value.audit)
    && value.audit.every(isSessionChapterAuditEntry)
  );
}

function buildChapters({
  sessionId,
  workspaceId,
  workspaceName,
  messages,
  policy,
  now,
}: {
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  messages: ChatMessage[];
  policy: SessionChapterPolicy;
  now: string;
}): SessionChapter[] {
  const groups: ChatMessage[][] = [];
  let current: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === 'user' && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(message);
  }
  if (current.length) groups.push(current);

  return groups.map((group, index) => {
    const messageIds = group.map((message) => message.id);
    const sourceTraceRefs = uniqueStrings([
      ...messageIds.map((id) => `message:${id}`),
      ...group.flatMap((message) => (message.processEntries ?? []).map((entry) => `process:${entry.id}`)),
    ]);
    const evidenceRefs = uniqueStrings(group.flatMap(collectEvidenceRefs));
    const validationRefs = uniqueStrings(group.flatMap(collectValidationRefs));
    const summary = summarizeMessages(group);
    return {
      id: `chapter:${sessionId}:${index + 1}`,
      sessionId,
      workspaceId,
      workspaceName,
      title: `Chapter ${index + 1}: ${titleFromGroup(group)}`,
      status: group.length >= policy.compressAfterMessageCount && policy.automaticCompression ? 'compressed' : 'active',
      startedAt: now,
      updatedAt: now,
      messageIds,
      sourceTraceRefs,
      evidenceRefs,
      validationRefs,
      compressedContext: {
        summary,
        carryForward: buildCarryForward(group, evidenceRefs, validationRefs),
        sourceTraceRefs,
        evidenceRefs,
        validationRefs,
        retainedRecentMessageIds: messageIds.slice(-policy.retainRecentMessageCount),
        tokenBudget: policy.targetTokenBudget,
        createdAt: now,
      },
    };
  });
}

function titleFromGroup(group: ChatMessage[]): string {
  const seed = group.find((message) => message.role === 'user') ?? group[0];
  const text = compactText(seed?.content ?? 'Session activity');
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function summarizeMessages(group: ChatMessage[]): string {
  const assistant = group.filter((message) => message.role === 'assistant').at(-1);
  const seed = assistant ?? group.at(-1);
  const text = compactText(seed?.streamedContent || seed?.content || 'Session activity compressed.');
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function buildCarryForward(
  group: ChatMessage[],
  evidenceRefs: string[],
  validationRefs: string[],
): string[] {
  const latestUser = [...group].reverse().find((message) => message.role === 'user');
  return [
    latestUser ? `Latest user intent: ${compactText(latestUser.content)}` : 'Continue from the compressed chapter summary.',
    evidenceRefs.length ? `Evidence preserved: ${evidenceRefs.join(', ')}` : 'No explicit browser evidence refs were recorded in this chapter.',
    validationRefs.length ? `Validation preserved: ${validationRefs.join(', ')}` : 'No validation refs were recorded in this chapter.',
  ];
}

function collectEvidenceRefs(message: ChatMessage): string[] {
  const rawValues = [
    message.content,
    message.streamedContent,
    ...(message.cards ?? []).flatMap((card) => flattenUnknownStrings(card.args)),
    ...(message.processEntries ?? []).flatMap((entry) => [entry.summary, entry.transcript, ...flattenUnknownStrings(entry.payload)]),
  ].filter((value): value is string => typeof value === 'string');
  return uniqueStrings(rawValues.flatMap((value) => {
    const matches = value.match(/(?:output\/playwright|docs\/superpowers\/plans)\/[^\s'",)]+/g) ?? [];
    return matches.map((match) => `evidence:${match}`);
  }));
}

function collectValidationRefs(message: ChatMessage): string[] {
  return uniqueStrings((message.processEntries ?? [])
    .filter((entry) => (
      entry.status === 'failed'
      || /\b(validation|test|vitest|playwright|audit|verify|build)\b/i.test(`${entry.actor} ${entry.summary}`)
    ))
    .map((entry) => `validation:${entry.id}:${compactText(entry.summary).slice(0, 96)}`));
}

function flattenUnknownStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenUnknownStrings);
  if (isRecord(value)) return Object.values(value).flatMap(flattenUnknownStrings);
  return [];
}

function normalizeSessionChapterPolicy(policy: SessionChapterPolicy): SessionChapterPolicy {
  return {
    automaticCompression: policy.automaticCompression,
    compressAfterMessageCount: clampInteger(policy.compressAfterMessageCount, 1, 100, DEFAULT_SESSION_CHAPTER_POLICY.compressAfterMessageCount),
    targetTokenBudget: clampInteger(policy.targetTokenBudget, 512, 32_000, DEFAULT_SESSION_CHAPTER_POLICY.targetTokenBudget),
    retainRecentMessageCount: clampInteger(policy.retainRecentMessageCount, 1, 50, DEFAULT_SESSION_CHAPTER_POLICY.retainRecentMessageCount),
    preserveEvidenceRefs: policy.preserveEvidenceRefs,
  };
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function isSessionChapterPolicy(value: unknown): value is SessionChapterPolicy {
  if (!isRecord(value)) return false;
  return (
    typeof value.automaticCompression === 'boolean'
    && isPositiveInteger(value.compressAfterMessageCount)
    && isPositiveInteger(value.targetTokenBudget)
    && isPositiveInteger(value.retainRecentMessageCount)
    && typeof value.preserveEvidenceRefs === 'boolean'
  );
}

function isChapteredSession(value: unknown): value is ChapteredSession {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.sessionId)
    && isNonEmptyString(value.workspaceId)
    && isNonEmptyString(value.workspaceName)
    && isIsoDateString(value.updatedAt)
    && Array.isArray(value.chapters)
    && value.chapters.every(isSessionChapter)
  );
}

function isSessionChapter(value: unknown): value is SessionChapter {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.sessionId)
    && isNonEmptyString(value.workspaceId)
    && isNonEmptyString(value.workspaceName)
    && isNonEmptyString(value.title)
    && (value.status === 'active' || value.status === 'compressed')
    && isIsoDateString(value.startedAt)
    && isIsoDateString(value.updatedAt)
    && isStringArray(value.messageIds)
    && isStringArray(value.sourceTraceRefs)
    && isStringArray(value.evidenceRefs)
    && isStringArray(value.validationRefs)
    && isCompressedSessionContext(value.compressedContext)
  );
}

function isCompressedSessionContext(value: unknown): value is CompressedSessionContext {
  if (!isRecord(value)) return false;
  return (
    typeof value.summary === 'string'
    && isStringArray(value.carryForward)
    && isStringArray(value.sourceTraceRefs)
    && isStringArray(value.evidenceRefs)
    && isStringArray(value.validationRefs)
    && isStringArray(value.retainedRecentMessageIds)
    && isPositiveInteger(value.tokenBudget)
    && isIsoDateString(value.createdAt)
  );
}

function isSessionChapterAuditEntry(value: unknown): value is SessionChapterAuditEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.sessionId)
    && (value.action === 'projected' || value.action === 'policy-updated')
    && typeof value.summary === 'string'
    && isIsoDateString(value.createdAt)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
