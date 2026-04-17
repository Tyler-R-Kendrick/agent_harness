import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetIdSeq,
  branchDAG,
  commitToDAG,
  createVersionDAG,
  getTopologicalOrder,
  mergeDAGs,
  rollbackToCommit,
} from './versionHistory';

beforeEach(() => _resetIdSeq());

const AUTHOR = 'user-1';

describe('createVersionDAG', () => {
  it('creates a DAG with a single root commit on main branch', () => {
    const dag = createVersionDAG('hello', AUTHOR, 'Initial');
    const commits = Object.values(dag.commits);
    expect(commits).toHaveLength(1);
    expect(commits[0].parentIds).toHaveLength(0);
    expect(commits[0].content).toBe('hello');
    expect(commits[0].branchId).toBe('main');
    expect(Object.keys(dag.branches)).toEqual(['main']);
    expect(dag.currentBranchId).toBe('main');
    expect(dag.currentCommitId).toBe(commits[0].id);
  });
});

describe('commitToDAG', () => {
  it('adds a new commit as a child of the current commit on the same branch', () => {
    const dag = createVersionDAG('v1', AUTHOR);
    const rootId = dag.currentCommitId;
    const dag2 = commitToDAG(dag, 'v2', AUTHOR, 'Second commit');
    expect(Object.keys(dag2.commits)).toHaveLength(2);
    const newCommit = dag2.commits[dag2.currentCommitId];
    expect(newCommit.parentIds).toEqual([rootId]);
    expect(newCommit.content).toBe('v2');
    expect(newCommit.branchId).toBe('main');
    // Branch head advances
    expect(dag2.branches['main'].headCommitId).toBe(dag2.currentCommitId);
  });

  it('does not mutate the original DAG (immutable / CRDT-safe)', () => {
    const dag = createVersionDAG('v1', AUTHOR);
    const originalCommitCount = Object.keys(dag.commits).length;
    commitToDAG(dag, 'v2', AUTHOR, 'Second');
    expect(Object.keys(dag.commits)).toHaveLength(originalCommitCount);
  });
});

describe('branchDAG', () => {
  it('creates a new named branch pointing to the current commit', () => {
    const dag = createVersionDAG('v1', AUTHOR);
    const branched = branchDAG(dag, 'feature');
    expect(Object.keys(branched.branches)).toHaveLength(2);
    expect(branched.currentBranchId).not.toBe('main');
    const branch = Object.values(branched.branches).find((b) => b.name === 'feature')!;
    expect(branch.headCommitId).toBe(dag.currentCommitId);
  });

  it('can branch from a specific historical commit', () => {
    const dag0 = createVersionDAG('v1', AUTHOR);
    const rootId = dag0.currentCommitId;
    const dag1 = commitToDAG(dag0, 'v2', AUTHOR, 'v2');
    const branched = branchDAG(dag1, 'from-root', rootId);
    const branch = Object.values(branched.branches).find((b) => b.name === 'from-root')!;
    expect(branch.headCommitId).toBe(rootId);
    expect(branched.currentCommitId).toBe(rootId);
  });

  it('assigns unique colors to branches', () => {
    let dag = createVersionDAG('v1', AUTHOR);
    dag = branchDAG(dag, 'b1');
    dag = branchDAG(dag, 'b2');
    const colors = Object.values(dag.branches).map((b) => b.color);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});

describe('rollbackToCommit', () => {
  it('creates a new branch from the target commit', () => {
    const dag0 = createVersionDAG('v1', AUTHOR, 'Initial', 1_000);
    const dag1 = commitToDAG(dag0, 'v2', AUTHOR, 'Second', 2_000);
    const dag2 = commitToDAG(dag1, 'v3', AUTHOR, 'Third', 3_000);
    const rootId = dag0.currentCommitId;
    const rolled = rollbackToCommit(dag2, rootId, AUTHOR, 4_000);
    // A new branch exists (original had 1, rollback adds 1)
    expect(Object.keys(rolled.branches).length).toBeGreaterThan(1);
    const newBranch = Object.values(rolled.branches).find((b) => b.name.startsWith('rollback/'))!;
    expect(newBranch).toBeDefined();
    // Content is the rolled-back content
    const headCommit = rolled.commits[rolled.currentCommitId];
    expect(headCommit.content).toBe('v1');
  });
});

describe('mergeDAGs (CRDT)', () => {
  it('union of commits is commutative (A merge B == B merge A)', () => {
    const base = createVersionDAG('v1', AUTHOR, 'Root', 1_000);
    const a = commitToDAG(base, 'va', 'agent-1', 'Agent edit', 2_000);
    const b = commitToDAG(base, 'vb', AUTHOR, 'User edit', 2_001);
    const ab = mergeDAGs(a, b);
    const ba = mergeDAGs(b, a);
    expect(Object.keys(ab.commits)).toEqual(expect.arrayContaining(Object.keys(ba.commits)));
    expect(Object.keys(ab.commits).sort()).toEqual(Object.keys(ba.commits).sort());
  });

  it('merge is idempotent (A merge A == A)', () => {
    const dag = createVersionDAG('v1', AUTHOR);
    const merged = mergeDAGs(dag, dag);
    expect(Object.keys(merged.commits)).toHaveLength(Object.keys(dag.commits).length);
  });

  it('concurrent commits from different authors are both preserved', () => {
    const base = createVersionDAG('v1', AUTHOR, 'Root', 1_000);
    const user = commitToDAG(base, 'user-content', AUTHOR, 'User edit', 2_000);
    const agent = commitToDAG(base, 'agent-content', 'agent-1', 'Agent edit', 2_000);
    const merged = mergeDAGs(user, agent);
    expect(Object.keys(merged.commits)).toHaveLength(3); // root + user + agent
  });
});

describe('getTopologicalOrder', () => {
  it('returns commits in topological order (parents before children)', () => {
    const dag0 = createVersionDAG('v1', AUTHOR, 'Root', 1_000);
    const dag1 = commitToDAG(dag0, 'v2', AUTHOR, 'Second', 2_000);
    const dag2 = commitToDAG(dag1, 'v3', AUTHOR, 'Third', 3_000);
    const order = getTopologicalOrder(dag2);
    expect(order).toHaveLength(3);
    expect(order[0].id).toBe(dag0.currentCommitId);
    expect(order[2].id).toBe(dag2.currentCommitId);
  });

  it('handles branching: both branch lines appear after their common ancestor', () => {
    const base = createVersionDAG('v1', AUTHOR, 'Root', 1_000);
    const main = commitToDAG(base, 'v2', AUTHOR, 'main v2', 2_000);
    const feat = branchDAG(main, 'feature', base.currentCommitId, 1_500);
    const featCommit = commitToDAG(feat, 'f1', AUTHOR, 'feat v1', 2_500);
    const merged = mergeDAGs(main, featCommit);
    const order = getTopologicalOrder(merged);
    const rootIdx = order.findIndex((c) => c.parentIds.length === 0);
    const mainIdx = order.findIndex((c) => c.content === 'v2');
    expect(rootIdx).toBeLessThan(mainIdx);
  });
});
