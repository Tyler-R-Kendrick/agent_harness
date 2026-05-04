import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodiChat } from '../Codi';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const RESEARCHER_LABEL = 'Researcher';
export const RESEARCH_ARTIFACT_ROOT = '.research';
export const RESEARCH_ARTIFACT_FILENAME = 'research.md';

export type ResearchToolHint = 'curl-or-cli' | 'browser-use' | 'web-search' | 'web-scrape' | 'mcp-docs';
export type ResearchSourceType = 'official' | 'primary' | 'standard' | 'documentation' | 'analysis' | 'community' | 'unknown';

export interface ResearchSourceInput {
  title: string;
  domain: string;
  evidence: string;
  url?: string;
  sourceType?: ResearchSourceType;
  publishedAt?: string;
  retrievedAt?: string;
}

export interface ResearchSource extends ResearchSourceInput {
  sourceType: ResearchSourceType;
  qualityScore: number;
}

export interface ResearchConflictInput {
  claim: string;
  sources: ResearchSource[];
}

export interface ResearchConflictResolution {
  claim: string;
  selectedSource: ResearchSource;
  reason: string;
  alternatives: ResearchSource[];
}

export interface CreateResearchTaskRecordInput {
  taskId: string;
  topic: string;
  toolIds?: readonly string[];
  sources?: readonly ResearchSource[];
  conflicts?: readonly ResearchConflictResolution[];
  now?: string;
}

export interface ResearchTaskRecord {
  taskId: string;
  topic: string;
  artifactRoot: string;
  artifactPath: string;
  toolHints: ResearchToolHint[];
  sources: ResearchSource[];
  conflicts: ResearchConflictResolution[];
  createdAt: string;
  updatedAt: string;
}

export function isResearchTaskText(text: string): boolean {
  return /\b(research|investigate|source|sources|citation|citations|cite|provenance|evidence|fact[-\s]?check|conflicting information|disinfo)\b/i.test(text);
}

export function buildResearcherOperatingInstructions(): string {
  return [
    '# Researcher',
    '',
    '## Purpose',
    '- Research topics, claims, and decisions using the best available evidence in the active workspace.',
    '',
    '## Goals',
    '- Start from authoritative sources first: official docs, primary publications, standards, changelogs, source repositories, and regulator or vendor pages.',
    '- Use whichever research tools are currently available, including web search, browser-use, scraping, curl or CLI, and MCP documentation tools, without assuming any one provider exists.',
    '- Produce citations and provenance for material claims.',
    '- Score source quality so weak, stale, uncited, or low-authority information can be pruned.',
    '- Resolve conflicting information by source quality first, then by recency when quality is comparable.',
    '',
    '## Constraints',
    '- Do not invent citations or pretend to have checked sources that were not actually inspected.',
    '- Separate direct evidence from inference.',
    '- Keep uncertainty visible when sources disagree or evidence is incomplete.',
    '- Prefer narrow tool use that directly improves evidence, provenance, or execution.',
    '',
    '## Workflow',
    '1. Restate the research question as claims or decisions that need evidence.',
    '2. Identify likely authoritative sources before searching broadly.',
    '3. Gather evidence with the available tools and record title, URL or file path, publisher or domain, retrieved date, and publication/update date when available.',
    '4. Rank sources by authority, directness, provenance, and recency.',
    '5. Resolve conflicts explicitly and cite the selected source plus relevant alternatives.',
    '6. Persist reusable research output under `.research/<task-id>/research.md`.',
    '',
    '## Deliverables',
    '- A concise answer with citations near the claims they support.',
    '- A `.research/<task-id>/research.md` artifact containing sources, quality notes, conflict decisions, and open questions when the work should be reused.',
  ].join('\n');
}

export function buildResearcherSystemPrompt({
  workspaceName,
  modelId,
}: {
  workspaceName?: string;
  modelId?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Research topics, claims, and decisions with provenance, citations, source-quality ranking, conflict resolution, and reusable research artifacts.',
      scenario: 'research',
      constraints: [
        'Use only the tools that are currently available for this task; do not assume search, scraping, curl, browser-use, or MCP tools exist.',
        'Persist reusable research output under `.research/<task-id>/research.md` when the task produces reusable findings.',
      ],
      agentKind: 'researcher',
      modelId,
    }),
    '## Researcher Operating Instructions',
    buildResearcherOperatingInstructions(),
  ].join('\n\n');
}

export function buildResearcherToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
}): string {
  return [
    buildResearcherSystemPrompt({ workspaceName }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamResearcherChat(
  {
    runtimeProvider,
    model,
    modelId,
    sessionId,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters = [],
  }: {
    runtimeProvider: ModelBackedAgentProvider;
    model?: HFModel;
    modelId?: string;
    sessionId?: string;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    latestUserInput: string;
    voters?: IVoter[];
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const systemPrompt = buildResearcherSystemPrompt({ workspaceName, modelId: runtimeProvider === 'codi' ? model?.id : modelId });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Researcher GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (!model) {
    throw new Error('Researcher Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    voters,
    systemPrompt,
  }, callbacks, signal);
}

export function normalizeResearchTaskId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'research-task';
}

export function getResearchArtifactRoot(taskId: string): string {
  return `${RESEARCH_ARTIFACT_ROOT}/${normalizeResearchTaskId(taskId)}`;
}

export function getResearchArtifactPath(taskId: string): string {
  return `${getResearchArtifactRoot(taskId)}/${RESEARCH_ARTIFACT_FILENAME}`;
}

export function inferResearchToolHints(toolIds: readonly string[] = []): ResearchToolHint[] {
  const hints: ResearchToolHint[] = [];
  const add = (hint: ResearchToolHint) => {
    if (!hints.includes(hint)) hints.push(hint);
  };

  for (const toolId of toolIds) {
    const lowered = toolId.toLowerCase();
    if (/(cli|curl|shell|terminal)/.test(lowered)) add('curl-or-cli');
    if (/(browser|navigate|page|viewport|inbrowser)/.test(lowered)) add('browser-use');
    if (/(web[-_ ]?search|search_web|internet)/.test(lowered)) add('web-search');
    if (/(scrape|fetch|readability|extract)/.test(lowered)) add('web-scrape');
    if (/(mcp|docs?|documentation|reference)/.test(lowered)) add('mcp-docs');
  }

  return hints;
}

function parseTime(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreRecency(source: ResearchSourceInput, now: string): number {
  const sourceTime = parseTime(source.publishedAt) || parseTime(source.retrievedAt);
  const nowTime = parseTime(now);
  if (!sourceTime || !nowTime) return 0.1;
  const ageDays = Math.max(0, (nowTime - sourceTime) / 86_400_000);
  if (ageDays <= 30) return 0.25;
  if (ageDays <= 180) return 0.18;
  if (ageDays <= 730) return 0.1;
  return 0.03;
}

function sourceTypeScore(sourceType: ResearchSourceType): number {
  switch (sourceType) {
    case 'official':
    case 'primary':
      return 0.45;
    case 'standard':
    case 'documentation':
      return 0.38;
    case 'analysis':
      return 0.25;
    case 'community':
      return 0.12;
    default:
      return 0.08;
  }
}

function provenanceScore(source: ResearchSourceInput): number {
  let score = 0;
  if (source.url) score += 0.12;
  if (source.domain) score += 0.08;
  if (source.publishedAt) score += 0.05;
  if (source.retrievedAt) score += 0.05;
  return score;
}

function evidenceScore(source: ResearchSourceInput): number {
  return source.evidence.trim().length >= 24 ? 0.15 : 0.04;
}

export function scoreResearchSource(source: ResearchSourceInput, now = new Date().toISOString()): ResearchSource {
  const sourceType = source.sourceType ?? 'unknown';
  const qualityScore = Number((
    sourceTypeScore(sourceType)
    + provenanceScore(source)
    + evidenceScore(source)
    + scoreRecency(source, now)
  ).toFixed(3));

  return {
    ...source,
    sourceType,
    qualityScore: Math.min(1, qualityScore),
  };
}

export function rankResearchSources(sources: readonly ResearchSource[]): ResearchSource[] {
  return [...sources].sort((left, right) => (
    right.qualityScore - left.qualityScore
    || parseTime(right.publishedAt ?? right.retrievedAt) - parseTime(left.publishedAt ?? left.retrievedAt)
    || left.title.localeCompare(right.title)
  ));
}

export function resolveResearchConflict(input: ResearchConflictInput): ResearchConflictResolution {
  if (input.sources.length === 0) {
    throw new TypeError('Cannot resolve a research conflict without sources.');
  }

  const ranked = rankResearchSources(input.sources);
  const [selected, runnerUp] = ranked;
  const scoreGap = runnerUp ? selected.qualityScore - runnerUp.qualityScore : selected.qualityScore;
  const reason = runnerUp && scoreGap <= 0.05
    ? `Selected "${selected.title}" because it is more recent among comparable-quality sources.`
    : `Selected "${selected.title}" because it has higher source quality.`;

  return {
    claim: input.claim,
    selectedSource: selected,
    reason,
    alternatives: ranked.slice(1),
  };
}

export function createResearchTaskRecord(input: CreateResearchTaskRecordInput): ResearchTaskRecord {
  const now = input.now ?? new Date().toISOString();
  const taskId = normalizeResearchTaskId(input.taskId);
  return {
    taskId,
    topic: input.topic,
    artifactRoot: getResearchArtifactRoot(taskId),
    artifactPath: getResearchArtifactPath(taskId),
    toolHints: inferResearchToolHints(input.toolIds),
    sources: rankResearchSources(input.sources ?? []),
    conflicts: [...(input.conflicts ?? [])],
    createdAt: now,
    updatedAt: now,
  };
}

function sourceLabel(source: ResearchSource): string {
  return source.url ? `[${source.title}](${source.url})` : source.title;
}

export function renderResearchTaskMarkdown(task: ResearchTaskRecord): string {
  const sourceLines = task.sources.length
    ? task.sources.map((source) => [
        `- ${sourceLabel(source)} (${source.domain}; ${source.sourceType}; quality: ${source.qualityScore.toFixed(3)})`,
        `  - Evidence: ${source.evidence}`,
        source.publishedAt ? `  - Published: ${source.publishedAt}` : null,
        source.retrievedAt ? `  - Retrieved: ${source.retrievedAt}` : null,
      ].filter(Boolean).join('\n'))
    : ['- No sources recorded yet.'];

  const conflictLines = task.conflicts.length
    ? task.conflicts.map((conflict) => [
        `- ${conflict.claim}`,
        `  - Decision: ${sourceLabel(conflict.selectedSource)}`,
        `  - Reason: ${conflict.reason}`,
      ].join('\n'))
    : ['- No conflicts recorded yet.'];

  return [
    `# Research: ${task.topic}`,
    '',
    `Task ID: \`${task.taskId}\``,
    `Artifact path: \`${task.artifactPath}\``,
    `Updated: ${task.updatedAt}`,
    '',
    '## Tool Hints',
    task.toolHints.length ? task.toolHints.map((hint) => `- ${hint}`).join('\n') : '- No specific tool capabilities detected.',
    '',
    '## Sources',
    ...sourceLines,
    '',
    '## Conflict Resolutions',
    ...conflictLines,
    '',
  ].join('\n');
}
