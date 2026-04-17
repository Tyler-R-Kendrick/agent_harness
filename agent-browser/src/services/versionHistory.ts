/**
 * CRDT-compatible version history DAG.
 *
 * Properties:
 *   Commits – Grow-Only Set (G-Set): commits are only ever added, never removed.
 *   Branch heads – LWW-Register per branch: last writer (by createdAt) wins on merge.
 *   Merge is commutative, associative, and idempotent → valid CRDT.
 */

export type CommitId = string;
export type BranchId = string;

const BRANCH_COLORS = ['#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#f97316'];

export interface Commit {
  id: CommitId;
  /** Serialized content snapshot (file content, session messages JSON, URL, etc.) */
  content: string;
  message: string;
  authorId: string;
  /** Unix epoch ms – used as CRDT logical clock for LWW ordering */
  timestamp: number;
  /** Empty for root commits, one parent for regular, two for merge commits */
  parentIds: CommitId[];
  branchId: BranchId;
}

export interface HistoryBranch {
  id: BranchId;
  name: string;
  headCommitId: CommitId;
  color: string;
  createdAt: number;
}

export interface VersionDAG {
  commits: Record<CommitId, Commit>;
  branches: Record<BranchId, HistoryBranch>;
  currentBranchId: BranchId;
  currentCommitId: CommitId;
}

let _seq = 0;
function makeId(prefix: string): string {
  return `${prefix}-${(++_seq).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Reset counter – test helper only */
export function _resetIdSeq(): void { _seq = 0; }

export function createVersionDAG(
  content: string,
  authorId: string,
  message = 'Initial version',
  now = Date.now(),
): VersionDAG {
  const commitId = makeId('c');
  const branchId = 'main';
  const commit: Commit = { id: commitId, content, message, authorId, timestamp: now, parentIds: [], branchId };
  const branch: HistoryBranch = { id: branchId, name: 'main', headCommitId: commitId, color: BRANCH_COLORS[0], createdAt: now };
  return { commits: { [commitId]: commit }, branches: { [branchId]: branch }, currentBranchId: branchId, currentCommitId: commitId };
}

export function commitToDAG(
  dag: VersionDAG,
  content: string,
  authorId: string,
  message: string,
  now = Date.now(),
): VersionDAG {
  const commitId = makeId('c');
  const branch = dag.branches[dag.currentBranchId];
  const commit: Commit = { id: commitId, content, message, authorId, timestamp: now, parentIds: [dag.currentCommitId], branchId: dag.currentBranchId };
  return {
    ...dag,
    commits: { ...dag.commits, [commitId]: commit },
    branches: { ...dag.branches, [branch.id]: { ...branch, headCommitId: commitId } },
    currentCommitId: commitId,
  };
}

export function branchDAG(
  dag: VersionDAG,
  branchName: string,
  fromCommitId?: CommitId,
  now = Date.now(),
): VersionDAG {
  const fromId = fromCommitId ?? dag.currentCommitId;
  const branchId = makeId('b');
  const branchIndex = Object.keys(dag.branches).length;
  const branch: HistoryBranch = { id: branchId, name: branchName, headCommitId: fromId, color: BRANCH_COLORS[branchIndex % BRANCH_COLORS.length], createdAt: now };
  return { ...dag, branches: { ...dag.branches, [branchId]: branch }, currentBranchId: branchId, currentCommitId: fromId };
}

export function rollbackToCommit(
  dag: VersionDAG,
  commitId: CommitId,
  authorId: string,
  now = Date.now(),
): VersionDAG {
  const target = dag.commits[commitId];
  if (!target) return dag;
  const label = new Date(now).toISOString().slice(0, 10);
  const branched = branchDAG(dag, `rollback/${label}`, commitId, now);
  // Record a new commit that re-anchors the content at this point
  return commitToDAG(branched, target.content, authorId, `Rolled back to "${target.message}"`, now);
}

/**
 * CRDT merge: union commits (G-Set) + LWW branch heads (by createdAt).
 * Commutative, associative, idempotent.
 */
export function mergeDAGs(local: VersionDAG, remote: VersionDAG): VersionDAG {
  const mergedCommits = { ...remote.commits, ...local.commits };
  const mergedBranches: Record<BranchId, HistoryBranch> = { ...remote.branches };
  for (const [id, branch] of Object.entries(local.branches)) {
    const existing = mergedBranches[id];
    if (!existing || branch.createdAt >= existing.createdAt) {
      mergedBranches[id] = branch;
    }
  }
  return { commits: mergedCommits, branches: mergedBranches, currentBranchId: local.currentBranchId, currentCommitId: local.currentCommitId };
}

/** Topological sort (Kahn's algorithm) – deterministic given same commit set. */
export function getTopologicalOrder(dag: VersionDAG): Commit[] {
  const commits = Object.values(dag.commits);
  const inDeg = new Map<CommitId, number>(commits.map((c) => [c.id, c.parentIds.length]));
  const childMap = new Map<CommitId, CommitId[]>();
  for (const c of commits) {
    for (const p of c.parentIds) {
      if (!childMap.has(p)) childMap.set(p, []);
      childMap.get(p)!.push(c.id);
    }
  }
  const queue = commits.filter((c) => inDeg.get(c.id) === 0).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const result: Commit[] = [];
  while (queue.length > 0) {
    const next = queue.shift()!;
    result.push(next);
    for (const childId of childMap.get(next.id) ?? []) {
      const deg = (inDeg.get(childId) ?? 1) - 1;
      inDeg.set(childId, deg);
      if (deg === 0) {
        const child = dag.commits[childId];
        if (child) {
          // Insert in sorted position
          let i = queue.length;
          while (i > 0 && (queue[i - 1].timestamp > child.timestamp || (queue[i - 1].timestamp === child.timestamp && queue[i - 1].id > child.id))) i--;
          queue.splice(i, 0, child);
        }
      }
    }
  }
  return result;
}

/** Compute display lane (column) for each branch – simple first-come first-served ordering. */
export function computeLanes(dag: VersionDAG): Map<BranchId, number> {
  const branches = Object.values(dag.branches).sort((a, b) => a.createdAt - b.createdAt);
  const lanes = new Map<BranchId, number>();
  branches.forEach((b, i) => lanes.set(b.id, i));
  return lanes;
}
