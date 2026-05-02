import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodiChat } from '../Codi';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const PLANNER_AGENT_ID = 'planner';
export const PLANNER_LABEL = 'Planner';
export const PLANNER_TASK_ARTIFACT_PATH = '.planner/tasks.json';
export const PLANNER_BOARD_ARTIFACT_PATH = '.planner/board.md';

export type PlannerTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';
export type PlannerTaskSource = 'local' | 'external';
export type PlannerExternalTaskManagerKind = 'linear' | 'github' | 'custom';
export type PlannerExternalTaskManagerMode = 'mirror' | 'authority';
export type PlannerSessionStatus = 'running' | 'idle' | 'stalled' | 'stopped';
export type PlannerSessionSource = 'local-tab' | 'same-device' | 'external-device' | 'external-harness';

export interface PlannerExternalTaskRef {
  managerId: string;
  kind: PlannerExternalTaskManagerKind;
  identifier: string;
  url?: string;
}

export interface PlannerTaskRecord {
  id: string;
  title: string;
  description: string;
  status: PlannerTaskStatus;
  priority: number | null;
  source: PlannerTaskSource;
  labels: string[];
  blockers: string[];
  externalRef?: PlannerExternalTaskRef;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlannerTaskRecordInput {
  id: string;
  title: string;
  description: string;
  status?: PlannerTaskStatus;
  priority?: number | null;
  source?: PlannerTaskSource;
  labels?: readonly string[];
  blockers?: readonly string[];
  externalRef?: PlannerExternalTaskRef;
  notes?: string;
  now?: string;
}

export interface PlannerTaskUpdate {
  id: string;
  title?: string;
  description?: string;
  status?: PlannerTaskStatus;
  priority?: number | null;
  source?: PlannerTaskSource;
  labels?: readonly string[];
  blockers?: readonly string[];
  externalRef?: PlannerExternalTaskRef;
  notes?: string;
  now?: string;
}

export interface PlannerExternalTaskManagerConfig {
  id: string;
  kind: PlannerExternalTaskManagerKind;
  label: string;
  enabled: boolean;
  mode: PlannerExternalTaskManagerMode;
  endpoint?: string;
  projectSlug?: string;
  lastSyncAt?: string;
}

export interface PlannerMonitoredSession {
  sessionId: string;
  agentId: string;
  label: string;
  deviceId: string;
  source: PlannerSessionSource;
  status: PlannerSessionStatus;
  taskIds: string[];
  lastEvent?: string;
  updatedAt: string;
}

export interface PlannerRuntimeSnapshot {
  generatedAt: string;
  staleAfterMs: number;
  tasks: PlannerTaskRecord[];
  externalManagers: PlannerExternalTaskManagerConfig[];
  sessions: Array<PlannerMonitoredSession & { stale: boolean }>;
}

type PlannerRuntimeSnapshotInput = {
  tasks?: readonly PlannerTaskRecord[];
  externalManagers?: readonly PlannerExternalTaskManagerConfig[];
  sessions?: readonly PlannerMonitoredSession[];
  now?: string;
  staleAfterMs?: number;
};

type PlannerRuntimeSummary = {
  tasks: Record<PlannerTaskStatus, number>;
  sessions: Record<PlannerSessionStatus | 'stale', number>;
  externalManagers: Record<'enabled' | 'disabled' | PlannerExternalTaskManagerMode, number>;
};

export function isPlannerTaskText(text: string): boolean {
  return /\b(symphony|orchestrat(?:e|ion|or)|delegated agents?|delegated workflow|planner agent|task board|local task management|subagents?|sub-agents?|agent sessions?|other device sessions?|external task managers?)\b/i.test(text)
    || /\bplan\b.*\b(agent|agents|workflow|delegat|subagent|sub-agent|task board|symphony)\b/i.test(text)
    || /\b(agent|agents|workflow|delegat|subagent|sub-agent|task board|symphony)\b.*\bplan\b/i.test(text)
    || /\bmonitor\b.*\b(agent|agents|sessions?|subagent|sub-agent|task board)\b/i.test(text);
}

export function buildPlannerOperatingInstructions(): string {
  return [
    '# Planner',
    '',
    '## Purpose',
    '- Plan and orchestrate project work for the active browser workspace without depending on a server daemon.',
    '- Translate Symphony-style scheduler requirements into local-first task management, agent routing, and monitoring inside the PWA SPA.',
    '',
    '## Runtime Posture',
    '- Planner runs entirely in the browser and remains useful in offline mode.',
    '- Treat local task management as authoritative by default, using `.planner/tasks.json`, `.planner/board.md`, and `/workspace/PLAN.md` as durable workspace artifacts when tools are available.',
    '- Configurable external task managers are optional mirrors or authorities; external task managers are optional and must never be required for offline planning.',
    '- Keep external sync explicit, reversible, and conflict-aware so local browser state can continue while Linear, GitHub, or custom task systems are unavailable.',
    '',
    '## Monitoring Responsibilities',
    '- Monitor ProcessLog, AgentBus, active agents, subagents, and other device sessions for progress, stale work, blockers, token/runtime drift, and handoff gaps.',
    '- Summarize monitored sessions by task, agent, device, last event, status, and staleness.',
    '- Prefer browser-visible artifacts and structured process updates over hidden scheduler state.',
    '',
    '## Workflow',
    '1. Normalize user intent into local task records with status, priority, blockers, labels, and optional external references.',
    '2. Decide whether external task managers should mirror local work or act as authority for a specific task set.',
    '3. Assign work to available browser agents, subagents, tools, or human handoff points with explicit ownership.',
    '4. Reconcile ProcessLog and AgentBus observations into the local task board.',
    '5. Surface stale sessions, blocked tasks, failed attempts, and cross-device conflicts before continuing execution.',
    '6. Keep planning output compact enough for the SPA to persist and replay.',
    '',
    '## Constraints',
    '- Do not assume network access, remote trackers, background daemons, or a persistent server database.',
    '- Do not treat a successful model response as task completion unless the task board or observed session state supports it.',
    '- Preserve user control over external task manager configuration and sync authority.',
  ].join('\n');
}

export function buildPlannerSystemPrompt({
  workspaceName,
}: {
  workspaceName?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Plan, schedule, monitor, and reconcile local-first browser agent work with optional external task manager sync.',
      scenario: 'coding',
      constraints: [
        'Run as a browser-native PWA planning agent that must remain useful offline.',
        'Treat local task state, ProcessLog, AgentBus, subagent activity, and cross-device session observations as first-class planning inputs.',
        'Use external task managers only when configured or explicitly requested.',
      ],
    }),
    '## Planner Operating Instructions',
    buildPlannerOperatingInstructions(),
  ].join('\n\n');
}

export function buildPlannerToolInstructions({
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
    buildPlannerSystemPrompt({ workspaceName }),
    [
      '## Planner Artifacts',
      `- Local task JSON: \`${PLANNER_TASK_ARTIFACT_PATH}\``,
      `- Local task board: \`${PLANNER_BOARD_ARTIFACT_PATH}\``,
      '- Existing execution plan bridge: `/workspace/PLAN.md` when workspace file tools are available.',
    ].join('\n'),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamPlannerChat(
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
  const systemPrompt = buildPlannerSystemPrompt({ workspaceName });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Planner GHCP chat requires a modelId and sessionId.');
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
    throw new Error('Planner Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters,
    systemPrompt,
  }, callbacks, signal);
}

export function normalizePlannerTaskId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'task';
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function normalizeList(values: readonly string[] | undefined, fallback: readonly string[] = []): string[] {
  return [...(values ?? fallback)]
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeLabels(values: readonly string[] | undefined, fallback: readonly string[] = []): string[] {
  return normalizeList(values, fallback).map((value) => value.toLowerCase());
}

function normalizeBlockers(values: readonly string[] | undefined, fallback: readonly string[] = []): string[] {
  return normalizeList(values, fallback).map(normalizePlannerTaskId);
}

export function createPlannerTaskRecord(input: CreatePlannerTaskRecordInput): PlannerTaskRecord {
  const now = nowIso(input.now);
  const record: PlannerTaskRecord = {
    id: normalizePlannerTaskId(input.id),
    title: input.title,
    description: input.description,
    status: input.status ?? 'pending',
    priority: input.priority ?? null,
    source: input.source ?? 'local',
    labels: normalizeLabels(input.labels),
    blockers: normalizeBlockers(input.blockers),
    ...(input.externalRef ? { externalRef: input.externalRef } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    createdAt: now,
    updatedAt: now,
  };
  return record;
}

export function upsertPlannerTask(tasks: readonly PlannerTaskRecord[], update: PlannerTaskUpdate): PlannerTaskRecord[] {
  const id = normalizePlannerTaskId(update.id);
  const now = nowIso(update.now);
  let found = false;
  const updated = tasks.map((task) => {
    if (task.id !== id) return task;
    found = true;
    return {
      ...task,
      ...(update.title !== undefined ? { title: update.title } : {}),
      ...(update.description !== undefined ? { description: update.description } : {}),
      ...(update.status !== undefined ? { status: update.status } : {}),
      ...(update.priority !== undefined ? { priority: update.priority } : {}),
      ...(update.source !== undefined ? { source: update.source } : {}),
      ...(update.labels !== undefined ? { labels: normalizeLabels(update.labels) } : {}),
      ...(update.blockers !== undefined ? { blockers: normalizeBlockers(update.blockers) } : {}),
      ...(update.externalRef !== undefined ? { externalRef: update.externalRef } : {}),
      ...(update.notes !== undefined ? { notes: update.notes } : {}),
      updatedAt: now,
    };
  });

  if (found) return updated;

  return [
    ...updated,
    createPlannerTaskRecord({
      id,
      title: update.title ?? id,
      description: update.description ?? '',
      status: update.status,
      priority: update.priority,
      source: update.source,
      labels: update.labels,
      blockers: update.blockers,
      externalRef: update.externalRef,
      notes: update.notes,
      now,
    }),
  ];
}

export function buildPlannerRuntimeSnapshot({
  tasks = [],
  externalManagers = [],
  sessions = [],
  now,
  staleAfterMs = 300_000,
}: PlannerRuntimeSnapshotInput): PlannerRuntimeSnapshot {
  const generatedAt = nowIso(now);
  const generatedAtMs = Date.parse(generatedAt);
  return {
    generatedAt,
    staleAfterMs,
    tasks: [...tasks],
    externalManagers: [...externalManagers],
    sessions: sessions.map((session) => {
      const updatedAtMs = Date.parse(session.updatedAt);
      const stale = Number.isFinite(generatedAtMs)
        && Number.isFinite(updatedAtMs)
        && generatedAtMs - updatedAtMs > staleAfterMs;
      return { ...session, stale };
    }),
  };
}

export function summarizePlannerRuntime(snapshot: PlannerRuntimeSnapshot): PlannerRuntimeSummary {
  const summary: PlannerRuntimeSummary = {
    tasks: { pending: 0, running: 0, done: 0, failed: 0, blocked: 0 },
    sessions: { running: 0, idle: 0, stalled: 0, stopped: 0, stale: 0 },
    externalManagers: { enabled: 0, disabled: 0, mirror: 0, authority: 0 },
  };

  for (const task of snapshot.tasks) {
    summary.tasks[task.status] += 1;
  }
  for (const session of snapshot.sessions) {
    summary.sessions[session.status] += 1;
    if (session.stale) summary.sessions.stale += 1;
  }
  for (const manager of snapshot.externalManagers) {
    summary.externalManagers[manager.enabled ? 'enabled' : 'disabled'] += 1;
    summary.externalManagers[manager.mode] += 1;
  }

  return summary;
}

export function renderPlannerTaskBoardMarkdown(snapshot: PlannerRuntimeSnapshot): string {
  const taskLines = snapshot.tasks.length
    ? snapshot.tasks.map((task) => {
      const external = task.externalRef ? ` (${task.externalRef.kind}:${task.externalRef.identifier})` : '';
      const blockers = task.blockers.length ? ` blockers: ${task.blockers.join(', ')}` : '';
      const notes = task.notes ? ` - ${task.notes}` : '';
      return `- ${task.title} [${task.status}]${external}${blockers}${notes}`;
    })
    : ['- No local planner tasks recorded.'];
  const sessionLines = snapshot.sessions.length
    ? snapshot.sessions.map((session) => {
      const flags = [session.status, session.stale ? 'stale' : null].filter(Boolean).join(', ');
      const taskList = session.taskIds.length ? ` tasks: ${session.taskIds.join(', ')}` : ' tasks: none';
      const lastEvent = session.lastEvent ? ` last event: ${session.lastEvent}` : '';
      return `- ${session.sessionId} [${flags}] ${session.label} on ${session.deviceId};${taskList}; source: ${session.source};${lastEvent}`;
    })
    : ['- No monitored sessions recorded.'];
  const managerLines = snapshot.externalManagers.length
    ? snapshot.externalManagers.map((manager) => `- ${manager.label} [${manager.enabled ? 'enabled' : 'disabled'}, ${manager.mode}] ${manager.kind}`)
    : ['- No external task managers configured.'];

  return [
    '# Planner Task Board',
    '',
    `Generated: ${snapshot.generatedAt}`,
    '',
    '## Tasks',
    ...taskLines,
    '',
    '## Monitored Sessions',
    ...sessionLines,
    '',
    '## External Task Managers',
    ...managerLines,
    '',
  ].join('\n');
}
