export type ScheduledAutomationCadence = 'once' | 'hourly' | 'daily' | 'weekly';
export type ScheduledAutomationRunStatus = 'passed' | 'failed' | 'canceled';
export type ScheduledAutomationNotificationRoute = 'none' | 'browser' | 'inbox';
export type ScheduledAutomationReviewTrigger = 'never' | 'failures' | 'always';

export interface ScheduledAutomationRetryPolicy {
  maxRetries: number;
}

export interface ScheduledAutomation {
  id: string;
  title: string;
  prompt: string;
  cadence: ScheduledAutomationCadence;
  enabled: boolean;
  nextRunAt: string | null;
  retryPolicy: ScheduledAutomationRetryPolicy;
  notificationRoute: ScheduledAutomationNotificationRoute;
  requiresReviewOn: ScheduledAutomationReviewTrigger;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledAutomationRun {
  id: string;
  automationId: string;
  status: ScheduledAutomationRunStatus;
  startedAt: string;
  completedAt: string;
  attempt: number;
  summary: string;
  evidence: string[];
  requiresReview: boolean;
}

export interface ScheduledAutomationInboxItem {
  id: string;
  automationId: string;
  runId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: 'needs-review';
}

export interface ScheduledAutomationState {
  automations: ScheduledAutomation[];
  runs: ScheduledAutomationRun[];
  inbox: ScheduledAutomationInboxItem[];
}

export interface ProjectDueScheduledAutomationsInput {
  state: ScheduledAutomationState;
  now: Date;
}

export interface RecordScheduledAutomationRunInput {
  state: ScheduledAutomationState;
  automationId: string;
  now: Date;
  run: {
    status: ScheduledAutomationRunStatus;
    summary: string;
    evidence: string[];
    requiresReview?: boolean;
  };
}

const CADENCES: ScheduledAutomationCadence[] = ['once', 'hourly', 'daily', 'weekly'];
const RUN_STATUSES: ScheduledAutomationRunStatus[] = ['passed', 'failed', 'canceled'];
const NOTIFICATION_ROUTES: ScheduledAutomationNotificationRoute[] = ['none', 'browser', 'inbox'];
const REVIEW_TRIGGERS: ScheduledAutomationReviewTrigger[] = ['never', 'failures', 'always'];

export const DEFAULT_SCHEDULED_AUTOMATION_STATE: ScheduledAutomationState = {
  automations: [
    {
      id: 'daily-workspace-audit',
      title: 'Daily workspace audit',
      prompt: 'Run a browser and workspace audit, then summarize stale evidence, failing checks, and review items.',
      cadence: 'daily',
      enabled: true,
      nextRunAt: '2026-05-06T09:00:00.000Z',
      retryPolicy: { maxRetries: 1 },
      notificationRoute: 'inbox',
      requiresReviewOn: 'failures',
      createdAt: '2026-05-06T00:00:00.000Z',
      updatedAt: '2026-05-06T00:00:00.000Z',
    },
    {
      id: 'weekly-verification-sweep',
      title: 'Weekly verification sweep',
      prompt: 'Run full Agent Browser verification, collect visual smoke evidence, and queue results that need review.',
      cadence: 'weekly',
      enabled: true,
      nextRunAt: '2026-05-08T15:00:00.000Z',
      retryPolicy: { maxRetries: 2 },
      notificationRoute: 'browser',
      requiresReviewOn: 'always',
      createdAt: '2026-05-06T00:00:00.000Z',
      updatedAt: '2026-05-06T00:00:00.000Z',
    },
  ],
  runs: [],
  inbox: [],
};

export function projectDueScheduledAutomations({
  state,
  now,
}: ProjectDueScheduledAutomationsInput): ScheduledAutomation[] {
  const nowMs = safeTime(now);
  return state.automations.filter((automation) => {
    if (!automation.enabled || !automation.nextRunAt) return false;
    const dueAtMs = Date.parse(automation.nextRunAt);
    return Number.isFinite(dueAtMs) && dueAtMs <= nowMs;
  });
}

export function recordScheduledAutomationRun({
  state,
  automationId,
  now,
  run,
}: RecordScheduledAutomationRunInput): ScheduledAutomationState {
  const automation = state.automations.find((entry) => entry.id === automationId);
  if (!automation) return cloneState(state);

  const completedAt = safeIso(now);
  const attempt = nextAttempt(state.runs, automationId);
  const requiresReview = run.requiresReview ?? shouldRequireReview(automation.requiresReviewOn, run.status);
  const runEntry: ScheduledAutomationRun = {
    id: `${automationId}:${completedAt}:${attempt}`,
    automationId,
    status: run.status,
    startedAt: completedAt,
    completedAt,
    attempt,
    summary: run.summary,
    evidence: [...run.evidence],
    requiresReview,
  };
  const updatedAutomation = advanceAutomation(automation, now);
  const runs = [runEntry, ...state.runs].slice(0, 50);
  const inbox = buildScheduledAutomationInbox({
    automations: state.automations.map((entry) => (entry.id === automationId ? updatedAutomation : entry)),
    runs,
    inbox: state.inbox,
  });

  return {
    automations: state.automations.map((entry) => (entry.id === automationId ? updatedAutomation : entry)),
    runs,
    inbox,
  };
}

export function buildScheduledAutomationInbox(state: ScheduledAutomationState): ScheduledAutomationInboxItem[] {
  const existingIds = new Set(state.inbox.map((item) => item.runId));
  const generated = state.runs
    .filter((run) => run.requiresReview || run.status === 'failed')
    .filter((run) => !existingIds.has(run.id))
    .map((run): ScheduledAutomationInboxItem => {
      const automation = state.automations.find((entry) => entry.id === run.automationId);
      const title = automation?.title ?? run.automationId;
      return {
        id: `inbox:${run.id}`,
        automationId: run.automationId,
        runId: run.id,
        title: `${title} needs review`,
        summary: run.summary,
        createdAt: run.completedAt,
        status: 'needs-review',
      };
    });
  return [...generated, ...state.inbox].slice(0, 50);
}

export function isScheduledAutomationState(value: unknown): value is ScheduledAutomationState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.automations)
    && value.automations.every(isScheduledAutomation)
    && Array.isArray(value.runs)
    && value.runs.every(isScheduledAutomationRun)
    && Array.isArray(value.inbox)
    && value.inbox.every(isScheduledAutomationInboxItem)
  );
}

export function updateScheduledAutomation(
  state: ScheduledAutomationState,
  automationId: string,
  patch: Partial<Pick<ScheduledAutomation, 'enabled' | 'cadence' | 'notificationRoute' | 'requiresReviewOn' | 'retryPolicy'>>,
  now = new Date(),
): ScheduledAutomationState {
  return {
    ...state,
    automations: state.automations.map((automation) => {
      if (automation.id !== automationId) return automation;
      return {
        ...automation,
        ...patch,
        retryPolicy: patch.retryPolicy ?? automation.retryPolicy,
        updatedAt: safeIso(now),
      };
    }),
  };
}

function advanceAutomation(automation: ScheduledAutomation, now: Date): ScheduledAutomation {
  const nextRunAt = nextRunForCadence(automation.cadence, now);
  return {
    ...automation,
    enabled: automation.cadence === 'once' ? false : automation.enabled,
    nextRunAt,
    updatedAt: safeIso(now),
  };
}

function nextRunForCadence(cadence: ScheduledAutomationCadence, now: Date): string | null {
  if (cadence === 'once') return null;
  const next = new Date(safeTime(now));
  if (cadence === 'hourly') next.setUTCHours(next.getUTCHours() + 1);
  if (cadence === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}

function shouldRequireReview(
  trigger: ScheduledAutomationReviewTrigger,
  status: ScheduledAutomationRunStatus,
): boolean {
  if (trigger === 'always') return true;
  if (trigger === 'failures') return status === 'failed';
  return false;
}

function nextAttempt(runs: ScheduledAutomationRun[], automationId: string): number {
  const latest = runs.find((run) => run.automationId === automationId);
  return latest ? latest.attempt + 1 : 1;
}

function cloneState(state: ScheduledAutomationState): ScheduledAutomationState {
  return {
    automations: state.automations.map((automation) => ({ ...automation, retryPolicy: { ...automation.retryPolicy } })),
    runs: state.runs.map((run) => ({ ...run, evidence: [...run.evidence] })),
    inbox: state.inbox.map((item) => ({ ...item })),
  };
}

function isScheduledAutomation(value: unknown): value is ScheduledAutomation {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && typeof value.prompt === 'string'
    && typeof value.cadence === 'string'
    && (CADENCES as string[]).includes(value.cadence)
    && typeof value.enabled === 'boolean'
    && (value.nextRunAt === null || isIsoDateString(value.nextRunAt))
    && isRetryPolicy(value.retryPolicy)
    && typeof value.notificationRoute === 'string'
    && (NOTIFICATION_ROUTES as string[]).includes(value.notificationRoute)
    && typeof value.requiresReviewOn === 'string'
    && (REVIEW_TRIGGERS as string[]).includes(value.requiresReviewOn)
    && isIsoDateString(value.createdAt)
    && isIsoDateString(value.updatedAt)
  );
}

function isScheduledAutomationRun(value: unknown): value is ScheduledAutomationRun {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.automationId)
    && typeof value.status === 'string'
    && (RUN_STATUSES as string[]).includes(value.status)
    && isIsoDateString(value.startedAt)
    && isIsoDateString(value.completedAt)
    && typeof value.attempt === 'number'
    && Number.isInteger(value.attempt)
    && value.attempt > 0
    && typeof value.summary === 'string'
    && Array.isArray(value.evidence)
    && value.evidence.every((entry) => typeof entry === 'string')
    && typeof value.requiresReview === 'boolean'
  );
}

function isScheduledAutomationInboxItem(value: unknown): value is ScheduledAutomationInboxItem {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.automationId)
    && isNonEmptyString(value.runId)
    && isNonEmptyString(value.title)
    && typeof value.summary === 'string'
    && isIsoDateString(value.createdAt)
    && value.status === 'needs-review'
  );
}

function isRetryPolicy(value: unknown): value is ScheduledAutomationRetryPolicy {
  if (!isRecord(value)) return false;
  return (
    typeof value.maxRetries === 'number'
    && Number.isInteger(value.maxRetries)
    && value.maxRetries >= 0
    && value.maxRetries <= 5
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function safeIso(date: Date): string {
  return new Date(safeTime(date)).toISOString();
}

function safeTime(date: Date): number {
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}
