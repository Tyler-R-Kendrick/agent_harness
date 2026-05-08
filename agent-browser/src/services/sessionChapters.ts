import type { ChatMessage } from '../types';
import { createPromptBudget, estimateTokenCount, fitTextToTokenBudget } from './promptBudget';

export type ContextManagerMode = 'standard' | 'caveman';

export interface ToolOutputCachePolicy {
  enabled: boolean;
  inlineTokenLimit: number;
  fileTokenThreshold: number;
  maxMemoryEntries: number;
  cacheRoot: string;
}

export interface SessionChapterPolicy {
  automaticCompression: boolean;
  compressAfterMessageCount: number;
  targetTokenBudget: number;
  retainRecentMessageCount: number;
  preserveEvidenceRefs: boolean;
  renderCompressedMessages: boolean;
  contextMode: ContextManagerMode;
  toolOutputCache: ToolOutputCachePolicy;
}

export interface ToolOutputCacheEntry {
  id: string;
  sessionId: string;
  sourceTraceRef: string;
  storage: 'memory' | 'file';
  tokenCount: number;
  summary: string;
  content?: string;
  path?: string;
  createdAt: string;
}

export interface CompressedSessionContext {
  summary: string;
  carryForward: string[];
  sourceTraceRefs: string[];
  evidenceRefs: string[];
  validationRefs: string[];
  toolOutputRefs: string[];
  retainedRecentMessageIds: string[];
  tokenBudget: number;
  estimatedTokens: number;
  contextMode: ContextManagerMode;
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
  toolOutputRefs: string[];
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
  toolOutputCache: Record<string, ToolOutputCacheEntry>;
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

export interface BuildContextManagedMessagesInput {
  state: ChapteredSessionState;
  sessionId: string;
  messages: ChatMessage[];
}

export type ContextManagedTranscriptItem =
  | { kind: 'message'; message: ChatMessage }
  | {
    kind: 'chapter-summary';
    chapterId: string;
    title: string;
    summary: string;
    originalMessageIds: string[];
    originalMessages: ChatMessage[];
    evidenceRefs: string[];
    validationRefs: string[];
    toolOutputRefs: string[];
  };

export interface BuildContextManagerSnapshotInput extends BuildContextManagedMessagesInput {
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ContextManagerSnapshot {
  status: 'ok' | 'warning' | 'critical';
  originalTokenEstimate: number;
  managedTokenEstimate: number;
  maxInputTokens: number;
  usageRatio: number;
  managedMessageCount: number;
  droppedOriginalMessageCount: number;
  compressedChapterCount: number;
  toolOutputCacheCount: number;
  latestSummary: string;
}

export const DEFAULT_SESSION_CHAPTER_POLICY: SessionChapterPolicy = {
  automaticCompression: true,
  compressAfterMessageCount: 2,
  targetTokenBudget: 1200,
  retainRecentMessageCount: 4,
  preserveEvidenceRefs: true,
  renderCompressedMessages: true,
  contextMode: 'standard',
  toolOutputCache: {
    enabled: true,
    inlineTokenLimit: 800,
    fileTokenThreshold: 2400,
    maxMemoryEntries: 50,
    cacheRoot: '.agent-browser/context-cache',
  },
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
          toolOutputRefs: ['tool-output:visual-tool'],
          compressedContext: {
            summary: 'Captured visual smoke evidence and preserved the checkpoint trace for review.',
            carryForward: [
              'Visual validation produced output/playwright/agent-browser-visual-smoke.png.',
              'Resume checkpoints and browser evidence remain linked to the original process trace.',
              'Tool output cache refs preserved: tool-output:visual-tool.',
            ],
            sourceTraceRefs: ['message:visual-eval-assistant', 'process:visual-tool'],
            evidenceRefs: ['evidence:output/playwright/agent-browser-visual-smoke.png'],
            validationRefs: ['validation:visual-tool:Capture browser screenshot'],
            toolOutputRefs: ['tool-output:visual-tool'],
            retainedRecentMessageIds: ['visual-eval-assistant'],
            tokenBudget: 1200,
            estimatedTokens: 35,
            contextMode: 'standard',
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
  toolOutputCache: {
    'tool-output:visual-tool': {
      id: 'tool-output:visual-tool',
      sessionId: 'visual-eval-session',
      sourceTraceRef: 'process:visual-tool',
      storage: 'memory',
      tokenCount: 120,
      summary: 'Visual smoke output preserved behind a cache ref.',
      content: 'Visual smoke output preserved behind a cache ref.',
      createdAt: '2026-05-08T04:00:00.000Z',
    },
  },
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
  const { chapters, toolOutputCacheEntries } = buildChapters({
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
    toolOutputCache: pruneToolOutputCache({
      ...state.toolOutputCache,
      ...Object.fromEntries(toolOutputCacheEntries.map((entry) => [entry.id, entry])),
    }, policy.toolOutputCache.maxMemoryEntries),
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
  const policy = normalizeSessionChapterPolicy(state.policy);
  const toolOutputCache = state.toolOutputCache ?? {};
  return [
    '## Chaptered Session Context',
    `Session: ${session.sessionId}`,
    `Workspace: ${session.workspaceName}`,
    `Compression policy: target ${policy.targetTokenBudget} tokens, retain ${policy.retainRecentMessageCount} recent messages`,
    `Context manager mode: ${policy.contextMode}`,
    `Tool output cache: ${Object.keys(toolOutputCache).length} entries`,
    ...chapters.flatMap((chapter, index) => [
      `${index + 1}. ${chapter.title}`,
      `Summary: ${formatContextManagerText(chapter.compressedContext.summary, policy.contextMode)}`,
      `Carry forward: ${chapter.compressedContext.carryForward.map((line) => formatContextManagerText(line, policy.contextMode)).join(' ')}`,
      `Source trace refs: ${chapter.sourceTraceRefs.join(', ') || 'none'}`,
      `Evidence refs: ${chapter.evidenceRefs.join(', ') || 'none'}`,
      `Validation refs: ${chapter.validationRefs.join(', ') || 'none'}`,
      `Tool output refs: ${formatToolOutputRefs(chapter.toolOutputRefs, toolOutputCache)}`,
    ]),
    policy.contextMode === 'caveman'
      ? 'Instruction: caveman mode is on; keep replies terse while preserving exact source trace refs, evidence refs, validation refs, and tool-output cache refs.'
      : 'Instruction: use compressed context for continuity, but cite source trace refs, evidence refs, validation refs, and tool-output cache refs whenever they matter. Do not treat compression as permission to ignore underlying browser evidence.',
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

export function buildContextManagedMessages({
  state,
  sessionId,
  messages,
}: BuildContextManagedMessagesInput): ChatMessage[] {
  const items = buildContextManagedTranscriptItems({ state, sessionId, messages });
  return items.flatMap((item) => {
    if (item.kind === 'message') return [item.message];
    return [{
      id: `context-summary:${item.chapterId}`,
      role: 'assistant' as const,
      status: 'complete' as const,
      isLocal: true,
      content: [
        `Context summary for ${formatChapterLabel(item.title)}`,
        item.summary,
        `Original messages preserved: ${item.originalMessageIds.join(', ')}`,
        item.evidenceRefs.length ? `Evidence refs: ${item.evidenceRefs.join(', ')}` : '',
        item.validationRefs.length ? `Validation refs: ${item.validationRefs.join(', ')}` : '',
        item.toolOutputRefs.length ? `Tool output refs: ${item.toolOutputRefs.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
    }];
  });
}

export function buildContextManagedTranscriptItems({
  state,
  sessionId,
  messages,
}: BuildContextManagedMessagesInput): ContextManagedTranscriptItem[] {
  const policy = normalizeSessionChapterPolicy(state.policy);
  if (!state.enabled || !policy.renderCompressedMessages) {
    return messages.map((message) => ({ kind: 'message' as const, message }));
  }

  const session = state.sessions[sessionId];
  if (!session?.chapters.length) {
    return messages.map((message) => ({ kind: 'message' as const, message }));
  }

  const messageById = new Map(messages.map((message) => [message.id, message]));
  const retainedMessageIds = new Set(
    messages
      .filter((message) => message.role !== 'system')
      .slice(-policy.retainRecentMessageCount)
      .map((message) => message.id),
  );
  const compactedChapters = session.chapters.filter((chapter) => (
    chapter.status === 'compressed'
    && !chapter.messageIds.some((id) => retainedMessageIds.has(id))
  ));
  const chapterByFirstMessageId = new Map<string, SessionChapter>();
  const chapterMessageIds = new Set<string>();

  for (const chapter of compactedChapters) {
    const firstMessageId = chapter.messageIds[0];
    if (firstMessageId) chapterByFirstMessageId.set(firstMessageId, chapter);
    chapter.messageIds.forEach((id) => chapterMessageIds.add(id));
  }

  const items: ContextManagedTranscriptItem[] = [];
  const emittedChapterIds = new Set<string>();

  for (const message of messages) {
    const chapter = chapterByFirstMessageId.get(message.id);
    if (chapter && !emittedChapterIds.has(chapter.id)) {
      emittedChapterIds.add(chapter.id);
      items.push({
        kind: 'chapter-summary',
        chapterId: chapter.id,
        title: chapter.title,
        summary: formatContextManagerText(chapter.compressedContext.summary, policy.contextMode),
        originalMessageIds: [...chapter.messageIds],
        originalMessages: chapter.messageIds.map((id) => messageById.get(id)).filter((entry): entry is ChatMessage => Boolean(entry)),
        evidenceRefs: [...chapter.evidenceRefs],
        validationRefs: [...chapter.validationRefs],
        toolOutputRefs: [...chapter.toolOutputRefs],
      });
    }

    if (!chapterMessageIds.has(message.id) || retainedMessageIds.has(message.id)) {
      items.push({ kind: 'message', message });
    }
  }

  return items;
}

export function buildContextManagerSnapshot({
  state,
  sessionId,
  messages,
  contextWindow = state.policy.targetTokenBudget + 1024,
  maxOutputTokens = 512,
}: BuildContextManagerSnapshotInput): ContextManagerSnapshot {
  const managedMessages = buildContextManagedMessages({ state, sessionId, messages });
  const originalTokenEstimate = estimateMessagesTokenCount(messages);
  const managedTokenEstimate = estimateMessagesTokenCount(managedMessages);
  const budget = createPromptBudget({ contextWindow, maxOutputTokens });
  const usageRatio = budget.maxInputTokens > 0 ? managedTokenEstimate / budget.maxInputTokens : 1;
  const session = state.sessions[sessionId];
  const compressedChapterCount = session?.chapters.filter((chapter) => chapter.status === 'compressed').length ?? 0;
  const droppedOriginalMessageCount = countHiddenOriginalMessages({ state, sessionId, messages });
  const latestSummary = session?.chapters.at(-1)?.compressedContext.summary ?? 'No compressed context available.';
  const status = usageRatio >= 0.95 ? 'critical' : usageRatio >= 0.8 ? 'warning' : 'ok';

  return {
    status,
    originalTokenEstimate,
    managedTokenEstimate,
    maxInputTokens: budget.maxInputTokens,
    usageRatio,
    managedMessageCount: managedMessages.length,
    droppedOriginalMessageCount,
    compressedChapterCount,
    toolOutputCacheCount: Object.keys(state.toolOutputCache ?? {}).length,
    latestSummary,
  };
}

export function isChapteredSessionState(value: unknown): value is ChapteredSessionState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && isSessionChapterPolicy(value.policy)
    && isRecord(value.sessions)
    && Object.values(value.sessions).every(isChapteredSession)
    && isRecord(value.toolOutputCache)
    && Object.values(value.toolOutputCache).every(isToolOutputCacheEntry)
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
}): { chapters: SessionChapter[]; toolOutputCacheEntries: ToolOutputCacheEntry[] } {
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

  const toolOutputCacheEntries: ToolOutputCacheEntry[] = [];
  const chapters = groups.map((group, index) => {
    const messageIds = group.map((message) => message.id);
    const groupToolOutputCacheEntries = collectToolOutputCacheEntries({
      sessionId,
      messages: group,
      policy: policy.toolOutputCache,
      now,
    });
    toolOutputCacheEntries.push(...groupToolOutputCacheEntries);
    const toolOutputRefs = groupToolOutputCacheEntries.map((entry) => entry.id);
    const sourceTraceRefs = uniqueStrings([
      ...messageIds.map((id) => `message:${id}`),
      ...group.flatMap((message) => (message.processEntries ?? []).map((entry) => `process:${entry.id}`)),
    ]);
    const evidenceRefs = uniqueStrings(group.flatMap(collectEvidenceRefs));
    const validationRefs = uniqueStrings(group.flatMap(collectValidationRefs));
    const summary = summarizeMessages(group);
    const carryForward = buildCarryForward(group, evidenceRefs, validationRefs, toolOutputRefs);
    const status: SessionChapter['status'] = group.length >= policy.compressAfterMessageCount && policy.automaticCompression ? 'compressed' : 'active';
    return {
      id: `chapter:${sessionId}:${index + 1}`,
      sessionId,
      workspaceId,
      workspaceName,
      title: `Chapter ${index + 1}: ${titleFromGroup(group)}`,
      status,
      startedAt: now,
      updatedAt: now,
      messageIds,
      sourceTraceRefs,
      evidenceRefs,
      validationRefs,
      toolOutputRefs,
      compressedContext: {
        summary,
        carryForward,
        sourceTraceRefs,
        evidenceRefs,
        validationRefs,
        toolOutputRefs,
        retainedRecentMessageIds: messageIds.slice(-policy.retainRecentMessageCount),
        tokenBudget: policy.targetTokenBudget,
        estimatedTokens: estimateTokenCount([summary, ...carryForward].join('\n')),
        contextMode: policy.contextMode,
        createdAt: now,
      },
    };
  });

  return { chapters, toolOutputCacheEntries };
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
  const keywords = extractSummaryKeywords(text).slice(0, 12);
  if (!keywords.length) return 'Compressed chapter activity with source refs preserved.';
  return `Compressed result covering ${keywords.join(', ')}.`;
}

function buildCarryForward(
  group: ChatMessage[],
  evidenceRefs: string[],
  validationRefs: string[],
  toolOutputRefs: string[] = [],
): string[] {
  const latestUser = [...group].reverse().find((message) => message.role === 'user');
  return [
    latestUser ? `Latest user intent: ${compactText(latestUser.content)}` : 'Continue from the compressed chapter summary.',
    evidenceRefs.length ? `Evidence preserved: ${evidenceRefs.join(', ')}` : 'No explicit browser evidence refs were recorded in this chapter.',
    validationRefs.length ? `Validation preserved: ${validationRefs.join(', ')}` : 'No validation refs were recorded in this chapter.',
    toolOutputRefs.length ? `Tool output cache refs preserved: ${toolOutputRefs.join(', ')}` : 'No large tool-output cache refs were recorded in this chapter.',
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

function collectToolOutputCacheEntries({
  sessionId,
  messages,
  policy,
  now,
}: {
  sessionId: string;
  messages: ChatMessage[];
  policy: ToolOutputCachePolicy;
  now: string;
}): ToolOutputCacheEntry[] {
  if (!policy.enabled) return [];
  const entries: ToolOutputCacheEntry[] = [];
  for (const message of messages) {
    for (const processEntry of message.processEntries ?? []) {
      const rawText = compactText([
        processEntry.transcript,
        ...flattenUnknownStrings(processEntry.payload),
      ].filter((value): value is string => typeof value === 'string').join('\n'));
      if (!rawText) continue;
      const tokenCount = estimateTokenCount(rawText);
      if (tokenCount <= policy.inlineTokenLimit) continue;
      const id = `tool-output:${processEntry.id}`;
      const storage = tokenCount >= policy.fileTokenThreshold ? 'file' : 'memory';
      entries.push({
        id,
        sessionId,
        sourceTraceRef: `process:${processEntry.id}`,
        storage,
        tokenCount,
        summary: fitTextToTokenBudget(`${processEntry.summary}: ${rawText}`, Math.max(16, Math.min(96, policy.inlineTokenLimit))),
        ...(storage === 'memory' ? { content: fitTextToTokenBudget(rawText, policy.inlineTokenLimit) } : {}),
        ...(storage === 'file' ? { path: `${policy.cacheRoot}/${sessionId}/${sanitizeCachePathSegment(processEntry.id)}.txt` } : {}),
        createdAt: now,
      });
    }
  }
  return entries;
}

function formatToolOutputRefs(
  refs: readonly string[],
  cache: Record<string, ToolOutputCacheEntry>,
): string {
  if (!refs.length) return 'none';
  return refs.map((ref) => {
    const entry = cache[ref];
    if (!entry) return ref;
    const location = entry.storage === 'file' ? entry.path : 'memory cache';
    return `${ref} (${entry.storage}, ${entry.tokenCount} tokens, ${location})`;
  }).join(', ');
}

function pruneToolOutputCache(
  cache: Record<string, ToolOutputCacheEntry>,
  maxEntries: number,
): Record<string, ToolOutputCacheEntry> {
  return Object.fromEntries(
    Object.values(cache)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, maxEntries)
      .map((entry) => [entry.id, entry]),
  );
}

function estimateMessagesTokenCount(messages: readonly ChatMessage[]): number {
  return estimateTokenCount(messages.map((message) => [
    message.role,
    message.content,
    message.streamedContent,
    ...(message.cards ?? []).flatMap((card) => flattenUnknownStrings(card.args)),
    ...(message.processEntries ?? []).flatMap((entry) => [
      entry.summary,
      entry.transcript,
      ...flattenUnknownStrings(entry.payload),
    ]),
  ].filter(Boolean).join('\n')).join('\n\n'));
}

function countHiddenOriginalMessages({
  state,
  sessionId,
  messages,
}: BuildContextManagedMessagesInput): number {
  const visibleMessageIds = new Set(
    buildContextManagedTranscriptItems({ state, sessionId, messages })
      .filter((item): item is Extract<ContextManagedTranscriptItem, { kind: 'message' }> => item.kind === 'message')
      .map((item) => item.message.id),
  );
  return messages.filter((message) => message.role !== 'system' && !visibleMessageIds.has(message.id)).length;
}

function formatContextManagerText(value: string, mode: ContextManagerMode): string {
  if (mode !== 'caveman') return value;
  return compactText(value)
    .replace(/\b(the|a|an|please|would|could|should)\b/gi, '')
    .replace(/\bevidence\b/gi, 'proof')
    .replace(/\bvalidation\b/gi, 'check')
    .replace(/\bcaptured\b/gi, 'got')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatChapterLabel(title: string): string {
  return title.match(/^Chapter\s+\d+/)?.[0] ?? 'compacted chapter';
}

function sanitizeCachePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'tool-output';
}

function flattenUnknownStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenUnknownStrings);
  if (isRecord(value)) return Object.values(value).flatMap(flattenUnknownStrings);
  return [];
}

function normalizeSessionChapterPolicy(policy: Partial<SessionChapterPolicy>): SessionChapterPolicy {
  const defaultToolCache = DEFAULT_SESSION_CHAPTER_POLICY.toolOutputCache;
  const patchToolCache = (isRecord(policy.toolOutputCache) ? policy.toolOutputCache : {}) as Partial<ToolOutputCachePolicy>;
  return {
    automaticCompression: policy.automaticCompression ?? DEFAULT_SESSION_CHAPTER_POLICY.automaticCompression,
    compressAfterMessageCount: clampInteger(policy.compressAfterMessageCount, 1, 100, DEFAULT_SESSION_CHAPTER_POLICY.compressAfterMessageCount),
    targetTokenBudget: clampInteger(policy.targetTokenBudget, 512, 32_000, DEFAULT_SESSION_CHAPTER_POLICY.targetTokenBudget),
    retainRecentMessageCount: clampInteger(policy.retainRecentMessageCount, 1, 50, DEFAULT_SESSION_CHAPTER_POLICY.retainRecentMessageCount),
    preserveEvidenceRefs: policy.preserveEvidenceRefs ?? DEFAULT_SESSION_CHAPTER_POLICY.preserveEvidenceRefs,
    renderCompressedMessages: policy.renderCompressedMessages ?? DEFAULT_SESSION_CHAPTER_POLICY.renderCompressedMessages,
    contextMode: policy.contextMode === 'caveman' ? 'caveman' : 'standard',
    toolOutputCache: {
      enabled: typeof patchToolCache.enabled === 'boolean' ? patchToolCache.enabled : defaultToolCache.enabled,
      inlineTokenLimit: clampInteger(
        typeof patchToolCache.inlineTokenLimit === 'number' ? patchToolCache.inlineTokenLimit : defaultToolCache.inlineTokenLimit,
        16,
        32_000,
        defaultToolCache.inlineTokenLimit,
      ),
      fileTokenThreshold: clampInteger(
        typeof patchToolCache.fileTokenThreshold === 'number' ? patchToolCache.fileTokenThreshold : defaultToolCache.fileTokenThreshold,
        16,
        128_000,
        defaultToolCache.fileTokenThreshold,
      ),
      maxMemoryEntries: clampInteger(
        typeof patchToolCache.maxMemoryEntries === 'number' ? patchToolCache.maxMemoryEntries : defaultToolCache.maxMemoryEntries,
        1,
        500,
        defaultToolCache.maxMemoryEntries,
      ),
      cacheRoot: typeof patchToolCache.cacheRoot === 'string' && patchToolCache.cacheRoot.trim()
        ? patchToolCache.cacheRoot.trim()
        : defaultToolCache.cacheRoot,
    },
  };
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractSummaryKeywords(value: string): string[] {
  const stopwords = new Set([
    'a',
    'an',
    'and',
    'are',
    'for',
    'from',
    'into',
    'the',
    'this',
    'that',
    'with',
    'while',
    'after',
    'before',
  ]);
  return uniqueStrings(
    value
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g)
      ?.filter((word) => !stopwords.has(word)) ?? [],
  );
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
    && typeof value.renderCompressedMessages === 'boolean'
    && (value.contextMode === 'standard' || value.contextMode === 'caveman')
    && isToolOutputCachePolicy(value.toolOutputCache)
  );
}

function isToolOutputCachePolicy(value: unknown): value is ToolOutputCachePolicy {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && isPositiveInteger(value.inlineTokenLimit)
    && isPositiveInteger(value.fileTokenThreshold)
    && isPositiveInteger(value.maxMemoryEntries)
    && isNonEmptyString(value.cacheRoot)
  );
}

function isToolOutputCacheEntry(value: unknown): value is ToolOutputCacheEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.sessionId)
    && isNonEmptyString(value.sourceTraceRef)
    && (value.storage === 'memory' || value.storage === 'file')
    && isPositiveInteger(value.tokenCount)
    && typeof value.summary === 'string'
    && (value.content === undefined || typeof value.content === 'string')
    && (value.path === undefined || typeof value.path === 'string')
    && isIsoDateString(value.createdAt)
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
    && isStringArray(value.toolOutputRefs)
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
    && isStringArray(value.toolOutputRefs)
    && isStringArray(value.retainedRecentMessageIds)
    && isPositiveInteger(value.tokenBudget)
    && isPositiveInteger(value.estimatedTokens)
    && (value.contextMode === 'standard' || value.contextMode === 'caveman')
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
