export type MemoryEntryState = 'candidate' | 'active' | 'deprecated';

export interface MemoryEntry {
  readonly id: string;
  readonly taskFamily: string;
  readonly procedureSummary: string;
  readonly successCount: number;
  readonly failureCount: number;
  readonly consecutiveFailures: number;
  readonly createdTick: number;
  readonly lastUsedTick: number;
  readonly state: MemoryEntryState;
}

export interface LifecycleThresholds {
  readonly promoteAfterSuccesses: number;
  readonly deprecateAfterConsecutiveFailures: number;
  readonly staleAfterTicks: number;
}

export interface TransitionLogRow {
  readonly tick: number;
  readonly entryId: string;
  readonly fromState: MemoryEntryState;
  readonly toState: MemoryEntryState;
  readonly reason: string;
}

export interface ScriptedTask {
  readonly tick: number;
  readonly taskFamily: string;
  readonly success: boolean;
  readonly trajectorySummary: string;
}

export const THRESHOLDS: LifecycleThresholds = {
  promoteAfterSuccesses: 2,
  deprecateAfterConsecutiveFailures: 2,
  staleAfterTicks: 20,
};

export function buildEntry(id: string, task: ScriptedTask): MemoryEntry {
  return {
    id,
    taskFamily: task.taskFamily,
    procedureSummary: task.trajectorySummary,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    createdTick: task.tick,
    lastUsedTick: task.tick,
    state: 'candidate',
  };
}

export function applyOutcome(
  entry: MemoryEntry,
  success: boolean,
  tick: number,
  thresholds: LifecycleThresholds,
): { readonly entry: MemoryEntry; readonly transition?: TransitionLogRow } {
  const successCount = entry.successCount + (success ? 1 : 0);
  const failureCount = entry.failureCount + (success ? 0 : 1);
  const consecutiveFailures = success ? 0 : entry.consecutiveFailures + 1;

  let toState: MemoryEntryState = entry.state;
  let reason = '';
  if (!success && consecutiveFailures >= thresholds.deprecateAfterConsecutiveFailures) {
    toState = 'deprecated';
    reason = 'repeated failure';
  } else if (tick - entry.lastUsedTick > thresholds.staleAfterTicks) {
    toState = 'deprecated';
    reason = 'staleness';
  } else if (success && entry.state === 'candidate' && successCount >= thresholds.promoteAfterSuccesses) {
    toState = 'active';
    reason = 'repeated success';
  }

  const next: MemoryEntry = {
    ...entry,
    successCount,
    failureCount,
    consecutiveFailures,
    lastUsedTick: tick,
    state: toState,
  };
  const transition: TransitionLogRow | undefined =
    toState === entry.state ? undefined : { tick, entryId: entry.id, fromState: entry.state, toState, reason };
  return { entry: next, transition };
}

export function scoreEntry(entry: MemoryEntry, taskFamily: string): number {
  if (entry.state === 'deprecated' || entry.taskFamily !== taskFamily) {
    return 0;
  }
  const attempts = entry.successCount + entry.failureCount;
  const successRatio = attempts === 0 ? 0.5 : entry.successCount / attempts;
  return 1 + successRatio;
}

export function retrieve(store: readonly MemoryEntry[], taskFamily: string): MemoryEntry | undefined {
  let best: MemoryEntry | undefined;
  let bestScore = 0;
  for (const entry of store) {
    const score = scoreEntry(entry, taskFamily);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

export const SCRIPT: readonly ScriptedTask[] = [
  { tick: 1, taskFamily: 'export-report', success: true, trajectorySummary: 'open menu > export > pick CSV > confirm' },
  { tick: 2, taskFamily: 'export-report', success: true, trajectorySummary: 'open menu > export > pick CSV > confirm' },
  { tick: 3, taskFamily: 'export-report', success: true, trajectorySummary: 'open menu > export > pick CSV > confirm' },
  { tick: 4, taskFamily: 'export-report', success: false, trajectorySummary: 'UI changed: export moved to toolbar' },
  { tick: 5, taskFamily: 'export-report', success: false, trajectorySummary: 'UI changed: export moved to toolbar' },
  { tick: 6, taskFamily: 'export-report', success: true, trajectorySummary: 'toolbar export button > pick CSV > confirm' },
  { tick: 7, taskFamily: 'export-report', success: true, trajectorySummary: 'toolbar export button > pick CSV > confirm' },
  { tick: 8, taskFamily: 'export-report', success: true, trajectorySummary: 'toolbar export button > pick CSV > confirm' },
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runSimulation(): { readonly store: MemoryEntry[]; readonly log: TransitionLogRow[] } {
  const store: MemoryEntry[] = [];
  const log: TransitionLogRow[] = [];
  let nextId = 1;

  for (const task of SCRIPT) {
    const retrieved = retrieve(store, task.taskFamily);
    if (retrieved === undefined) {
      if (task.success) {
        store.push(buildEntry(`M${nextId}`, task));
        nextId += 1;
      }
      continue;
    }
    const result = applyOutcome(retrieved, task.success, task.tick, THRESHOLDS);
    store[store.indexOf(retrieved)] = result.entry;
    if (result.transition !== undefined) {
      log.push(result.transition);
    }
  }
  return { store, log };
}

export function runDemo(): void {
  const { store, log } = runSimulation();

  assert(log.length === 3, 'exactly three lifecycle transitions occur');
  assert(log[0].entryId === 'M1' && log[0].toState === 'active' && log[0].tick === 3, 'M1 promoted at tick 3');
  assert(log[1].entryId === 'M1' && log[1].toState === 'deprecated' && log[1].tick === 5, 'M1 deprecated at tick 5');
  assert(log[2].entryId === 'M2' && log[2].toState === 'active' && log[2].tick === 8, 'M2 promoted at tick 8');
  assert(retrieve(store, 'export-report')!.id === 'M2', 'retrieval excludes deprecated M1');

  console.log('transition log:');
  for (const row of log) {
    console.log(`  tick ${row.tick}: ${row.entryId} ${row.fromState} -> ${row.toState} (${row.reason})`);
  }
  console.log('final memory-store report:');
  for (const entry of store) {
    console.log(
      `  ${entry.id} [${entry.state}] family=${entry.taskFamily} ` +
        `success=${entry.successCount} failure=${entry.failureCount} :: ${entry.procedureSummary}`,
    );
  }
  console.log('all assertions passed');
}

runDemo();
