import type { WorkspaceFile } from '../types';

export interface WorkspaceFileCrdtPatch {
  index: number;
  deleteCount: number;
  deleteText: string;
  insertText: string;
}

export interface WorkspaceFileCrdtOperation extends WorkspaceFileCrdtPatch {
  id: string;
  workspaceId: string;
  path: string;
  actorId: string;
  sequence: number;
  createdAt: string;
  parentOpId: string | null;
}

export interface WorkspaceFileCrdtSnapshot {
  id: string;
  workspaceId: string;
  path: string;
  opId: string | null;
  content: string;
  createdAt: string;
}

export interface WorkspaceFileCrdtHistory {
  version: 1;
  workspaceId: string;
  path: string;
  snapshots: WorkspaceFileCrdtSnapshot[];
  operations: WorkspaceFileCrdtOperation[];
  headOpId: string | null;
  actorSequences: Record<string, number>;
  updatedAt: string;
}

export type WorkspaceFileCrdtHistoriesByWorkspace = Record<string, Record<string, WorkspaceFileCrdtHistory>>;

export interface WorkspaceFileMaterializedVersion {
  content: string;
  path: string;
  opId: string | null;
  sourceSnapshotId: string;
  replayedOperationIds: string[];
  direction: 'replay' | 'rewind' | 'snapshot';
}

export function createWorkspaceFileCrdtHistory({
  workspaceId,
  path,
  content,
  actorId,
  now = new Date(),
}: {
  workspaceId: string;
  path: string;
  content: string;
  actorId: string;
  now?: Date;
}): WorkspaceFileCrdtHistory {
  const createdAt = now.toISOString();
  return {
    version: 1,
    workspaceId,
    path,
    snapshots: [{
      id: createSnapshotId(workspaceId, path, null, createdAt),
      workspaceId,
      path,
      opId: null,
      content,
      createdAt,
    }],
    operations: [],
    headOpId: null,
    actorSequences: { [actorId]: 0 },
    updatedAt: createdAt,
  };
}

export function appendWorkspaceFileCrdtDiff(
  history: WorkspaceFileCrdtHistory,
  nextContent: string,
  {
    actorId,
    now = new Date(),
    captureSnapshotEveryOperations = 0,
  }: {
    actorId: string;
    now?: Date;
    captureSnapshotEveryOperations?: number;
  },
): WorkspaceFileCrdtHistory {
  const current = materializeWorkspaceFileVersion(history).content;
  if (current === nextContent) return history;

  const createdAt = now.toISOString();
  const sequence = (history.actorSequences[actorId] ?? 0) + 1;
  const patch = computeTextPatch(current, nextContent);
  const operation: WorkspaceFileCrdtOperation = {
    id: createOperationId(history.workspaceId, history.path, actorId, sequence, createdAt),
    workspaceId: history.workspaceId,
    path: history.path,
    actorId,
    sequence,
    createdAt,
    parentOpId: history.headOpId,
    ...patch,
  };

  let next: WorkspaceFileCrdtHistory = {
    ...history,
    operations: [...history.operations, operation],
    headOpId: operation.id,
    actorSequences: {
      ...history.actorSequences,
      [actorId]: sequence,
    },
    updatedAt: createdAt,
  };

  if (
    captureSnapshotEveryOperations > 0
    && next.operations.length % captureSnapshotEveryOperations === 0
  ) {
    next = captureWorkspaceFileCrdtSnapshot(next, { now });
  }

  return next;
}

export function captureWorkspaceFileCrdtSnapshot(
  history: WorkspaceFileCrdtHistory,
  {
    opId = history.headOpId,
    now = new Date(),
  }: {
    opId?: string | null;
    now?: Date;
  } = {},
): WorkspaceFileCrdtHistory {
  const materialized = materializeWorkspaceFileVersion(history, opId);
  const createdAt = now.toISOString();
  const snapshot: WorkspaceFileCrdtSnapshot = {
    id: createSnapshotId(history.workspaceId, history.path, opId, createdAt),
    workspaceId: history.workspaceId,
    path: history.path,
    opId,
    content: materialized.content,
    createdAt,
  };

  return {
    ...history,
    snapshots: upsertById(history.snapshots, snapshot),
    updatedAt: createdAt,
  };
}

export function materializeWorkspaceFileVersion(
  history: WorkspaceFileCrdtHistory,
  opId: string | null = history.headOpId,
): WorkspaceFileMaterializedVersion {
  const operations = orderOperations(history.operations);
  const operationIndexes = new Map(operations.map((operation, index) => [operation.id, index]));
  const targetIndex = opId === null ? -1 : operationIndexes.get(opId);
  if (targetIndex === undefined) {
    throw new Error(`Unknown CRDT file operation: ${opId}`);
  }

  const closestSnapshot = selectClosestSnapshot(history.snapshots, operationIndexes, targetIndex);
  const snapshotIndex = closestSnapshot.opId === null ? -1 : operationIndexes.get(closestSnapshot.opId);
  if (snapshotIndex === undefined) {
    throw new Error(`Unknown CRDT file snapshot operation: ${closestSnapshot.opId}`);
  }

  let content = closestSnapshot.content;
  const replayedOperationIds: string[] = [];
  if (snapshotIndex < targetIndex) {
    for (let index = snapshotIndex + 1; index <= targetIndex; index += 1) {
      content = applyOperation(content, operations[index]);
      replayedOperationIds.push(operations[index].id);
    }
    return {
      content,
      path: history.path,
      opId,
      sourceSnapshotId: closestSnapshot.id,
      replayedOperationIds,
      direction: replayedOperationIds.length ? 'replay' : 'snapshot',
    };
  }

  if (snapshotIndex > targetIndex) {
    for (let index = snapshotIndex; index > targetIndex; index -= 1) {
      content = revertOperation(content, operations[index]);
      replayedOperationIds.push(operations[index].id);
    }
    return {
      content,
      path: history.path,
      opId,
      sourceSnapshotId: closestSnapshot.id,
      replayedOperationIds,
      direction: 'rewind',
    };
  }

  return {
    content,
    path: history.path,
    opId,
    sourceSnapshotId: closestSnapshot.id,
    replayedOperationIds,
    direction: 'snapshot',
  };
}

export function mergeWorkspaceFileCrdtHistories(
  left: WorkspaceFileCrdtHistory,
  right: WorkspaceFileCrdtHistory,
): WorkspaceFileCrdtHistory {
  if (left.workspaceId !== right.workspaceId || left.path !== right.path) {
    throw new Error('Cannot merge CRDT histories for different workspace files.');
  }
  const snapshots = orderSnapshots(mergeById(left.snapshots, right.snapshots));
  const operations = orderOperations(mergeById(left.operations, right.operations));
  const actorSequences = { ...left.actorSequences };
  for (const [actorId, sequence] of Object.entries(right.actorSequences)) {
    actorSequences[actorId] = Math.max(actorSequences[actorId] ?? 0, sequence);
  }
  const head = operations.at(-1) ?? null;
  const updatedAt = maxIso(left.updatedAt, right.updatedAt);
  return {
    version: 1,
    workspaceId: left.workspaceId,
    path: left.path,
    snapshots,
    operations,
    headOpId: head?.id ?? null,
    actorSequences,
    updatedAt,
  };
}

export function recordWorkspaceFileCrdtChanges(
  state: WorkspaceFileCrdtHistoriesByWorkspace,
  workspaceId: string,
  files: WorkspaceFile[],
  {
    actorId,
    now = new Date(),
  }: {
    actorId: string;
    now?: Date;
  },
): WorkspaceFileCrdtHistoriesByWorkspace {
  const currentWorkspace = state[workspaceId] ?? {};
  let workspaceChanged = false;
  const nextWorkspace = { ...currentWorkspace };

  for (const file of files) {
    const existing = nextWorkspace[file.path];
    if (!existing) {
      nextWorkspace[file.path] = createWorkspaceFileCrdtHistory({
        workspaceId,
        path: file.path,
        content: file.content,
        actorId,
        now: file.updatedAt ? new Date(file.updatedAt) : now,
      });
      workspaceChanged = true;
      continue;
    }

    const currentContent = materializeWorkspaceFileVersion(existing).content;
    if (currentContent === file.content) continue;

    nextWorkspace[file.path] = appendWorkspaceFileCrdtDiff(existing, file.content, {
      actorId,
      now: file.updatedAt ? new Date(file.updatedAt) : now,
      captureSnapshotEveryOperations: 8,
    });
    workspaceChanged = true;
  }

  if (!workspaceChanged) return state;
  return {
    ...state,
    [workspaceId]: nextWorkspace,
  };
}

export function listWorkspaceFileCrdtHistories(
  state: WorkspaceFileCrdtHistoriesByWorkspace,
  workspaceId: string,
): WorkspaceFileCrdtHistory[] {
  return Object.values(state[workspaceId] ?? {}).sort((left, right) => left.path.localeCompare(right.path));
}

export function isWorkspaceFileCrdtHistoriesByWorkspace(value: unknown): value is WorkspaceFileCrdtHistoriesByWorkspace {
  return isRecord(value)
    && Object.values(value).every((workspaceValue) => (
      isRecord(workspaceValue)
      && Object.values(workspaceValue).every(isWorkspaceFileCrdtHistory)
    ));
}

function computeTextPatch(previous: string, next: string): WorkspaceFileCrdtPatch {
  let prefixLength = 0;
  while (
    prefixLength < previous.length
    && prefixLength < next.length
    && previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffixIndex = previous.length - 1;
  let nextSuffixIndex = next.length - 1;
  while (
    previousSuffixIndex >= prefixLength
    && nextSuffixIndex >= prefixLength
    && previous[previousSuffixIndex] === next[nextSuffixIndex]
  ) {
    previousSuffixIndex -= 1;
    nextSuffixIndex -= 1;
  }

  const deleteText = previous.slice(prefixLength, previousSuffixIndex + 1);
  return {
    index: prefixLength,
    deleteCount: deleteText.length,
    deleteText,
    insertText: next.slice(prefixLength, nextSuffixIndex + 1),
  };
}

function applyOperation(content: string, operation: WorkspaceFileCrdtOperation): string {
  return content.slice(0, operation.index)
    + operation.insertText
    + content.slice(operation.index + operation.deleteCount);
}

function revertOperation(content: string, operation: WorkspaceFileCrdtOperation): string {
  return content.slice(0, operation.index)
    + operation.deleteText
    + content.slice(operation.index + operation.insertText.length);
}

function selectClosestSnapshot(
  snapshots: WorkspaceFileCrdtSnapshot[],
  operationIndexes: Map<string, number>,
  targetIndex: number,
): WorkspaceFileCrdtSnapshot {
  if (!snapshots.length) {
    throw new Error('Cannot materialize a CRDT file history without a snapshot.');
  }
  return [...snapshots].sort((left, right) => {
    const leftDistance = Math.abs(snapshotOperationIndex(left, operationIndexes) - targetIndex);
    const rightDistance = Math.abs(snapshotOperationIndex(right, operationIndexes) - targetIndex);
    return leftDistance - rightDistance
      || Date.parse(right.createdAt) - Date.parse(left.createdAt)
      || left.id.localeCompare(right.id);
  })[0];
}

function snapshotOperationIndex(snapshot: WorkspaceFileCrdtSnapshot, operationIndexes: Map<string, number>): number {
  if (snapshot.opId === null) return -1;
  return operationIndexes.get(snapshot.opId) ?? Number.POSITIVE_INFINITY;
}

function orderOperations(operations: WorkspaceFileCrdtOperation[]): WorkspaceFileCrdtOperation[] {
  return [...operations].sort((left, right) => (
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
    || left.sequence - right.sequence
    || left.actorId.localeCompare(right.actorId)
    || left.id.localeCompare(right.id)
  ));
}

function orderSnapshots(snapshots: WorkspaceFileCrdtSnapshot[]): WorkspaceFileCrdtSnapshot[] {
  return [...snapshots].sort((left, right) => (
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
    || left.id.localeCompare(right.id)
  ));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return mergeById(items, [item]);
}

function mergeById<T extends { id: string }>(left: T[], right: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of left) merged.set(item.id, item);
  for (const item of right) merged.set(item.id, item);
  return [...merged.values()];
}

function createOperationId(workspaceId: string, path: string, actorId: string, sequence: number, createdAt: string): string {
  return `file-op:${slugify(workspaceId)}:${slugify(path)}:${slugify(actorId)}:${sequence}:${slugify(createdAt)}`;
}

function createSnapshotId(workspaceId: string, path: string, opId: string | null, createdAt: string): string {
  return `file-snapshot:${slugify(workspaceId)}:${slugify(path)}:${opId ? slugify(opId) : 'root'}:${slugify(createdAt)}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function maxIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function isWorkspaceFileCrdtHistory(value: unknown): value is WorkspaceFileCrdtHistory {
  if (!isRecord(value)) return false;
  return (
    value.version === 1
    && typeof value.workspaceId === 'string'
    && typeof value.path === 'string'
    && Array.isArray(value.snapshots)
    && value.snapshots.every(isWorkspaceFileCrdtSnapshot)
    && Array.isArray(value.operations)
    && value.operations.every(isWorkspaceFileCrdtOperation)
    && (value.headOpId === null || typeof value.headOpId === 'string')
    && isNumberRecord(value.actorSequences)
    && typeof value.updatedAt === 'string'
  );
}

function isWorkspaceFileCrdtSnapshot(value: unknown): value is WorkspaceFileCrdtSnapshot {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.path === 'string'
    && (value.opId === null || typeof value.opId === 'string')
    && typeof value.content === 'string'
    && typeof value.createdAt === 'string';
}

function isWorkspaceFileCrdtOperation(value: unknown): value is WorkspaceFileCrdtOperation {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.path === 'string'
    && typeof value.actorId === 'string'
    && typeof value.sequence === 'number'
    && typeof value.createdAt === 'string'
    && (value.parentOpId === null || typeof value.parentOpId === 'string')
    && typeof value.index === 'number'
    && typeof value.deleteCount === 'number'
    && typeof value.deleteText === 'string'
    && typeof value.insertText === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'number');
}
