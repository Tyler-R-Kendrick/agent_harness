import { describe, it, expect } from 'vitest';
import { GitAgentBus, InMemoryAgentBus } from '../agentBus.js';
import { MockGitRepository } from '../mockGit.js';
import { PayloadType, type Payload } from '../types.js';

describe('InMemoryAgentBus', () => {
  it('starts with tail = 0', async () => {
    const bus = new InMemoryAgentBus();
    expect(await bus.tail()).toBe(0);
  });

  it('appends and returns sequential positions', async () => {
    const bus = new InMemoryAgentBus();
    const p0 = await bus.append({ type: PayloadType.Mail, from: 'user', content: 'hello' });
    const p1 = await bus.append({ type: PayloadType.Mail, from: 'user', content: 'world' });
    expect(p0).toBe(0);
    expect(p1).toBe(1);
    expect(await bus.tail()).toBe(2);
  });

  it('reads correct slice [start, end)', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '0' });
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '1' });
    await bus.append({ type: PayloadType.Mail, from: 'a', content: '2' });

    const entries = await bus.read(1, 3);
    expect(entries).toHaveLength(2);
    expect((entries[0].payload as { content: string }).content).toBe('1');
    expect((entries[1].payload as { content: string }).content).toBe('2');
  });

  it('poll resolves immediately when matching entries already exist', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'hey' });
    const results = await bus.poll(0, [PayloadType.Mail]);
    expect(results).toHaveLength(1);
    expect(results[0].payload.type).toBe(PayloadType.Mail);
  });

  it('poll waits and resolves when a matching entry is appended later', async () => {
    const bus = new InMemoryAgentBus();

    const pollPromise = bus.poll(0, [PayloadType.Result]);

    // Append a non-matching entry first, then the matching one.
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'nope' });
    await bus.append({
      type: PayloadType.Result,
      intentId: 'i1',
      output: 'done',
    });

    const entries = await pollPromise;
    expect(entries.some((e) => e.payload.type === PayloadType.Result)).toBe(true);
  });

  it('poll with start offset only returns entries at or after start', async () => {
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'first' });
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'second' });

    const entries = await bus.poll(1, [PayloadType.Mail]);
    expect(entries).toHaveLength(1);
    expect((entries[0].payload as { content: string }).content).toBe('second');
  });

  it('sets realtimeTs on each entry', async () => {
    const before = Date.now();
    const bus = new InMemoryAgentBus();
    await bus.append({ type: PayloadType.Mail, from: 'u', content: 'ts test' });
    const after = Date.now();
    const entries = await bus.read(0, 1);
    expect(entries[0].realtimeTs).toBeGreaterThanOrEqual(before);
    expect(entries[0].realtimeTs).toBeLessThanOrEqual(after);
  });

  it('stores appended AgentBus entries as mock git commits while preserving log reads', async () => {
    const git = new MockGitRepository<Payload>({ now: clock(1_000) });
    const bus = new GitAgentBus({ git });

    await bus.append({
      type: PayloadType.Mail,
      from: 'user',
      content: 'build a parser',
      meta: { actorId: 'user', actorRole: 'user' },
    });
    await bus.append({
      type: PayloadType.Intent,
      intentId: 'task-1',
      action: 'Update parser',
      meta: { actorId: 'planner', actorRole: 'planner', branchId: 'work/task-1-update-parser' },
    });

    expect(await bus.tail()).toBe(2);
    await expect(bus.read(0, 2)).resolves.toEqual([
      expect.objectContaining({ position: 0, payload: expect.objectContaining({ type: PayloadType.Mail }) }),
      expect.objectContaining({ position: 1, payload: expect.objectContaining({ type: PayloadType.Intent }) }),
    ]);
    await expect(bus.poll(1, [PayloadType.Intent])).resolves.toEqual([
      expect.objectContaining({ position: 1, payload: expect.objectContaining({ intentId: 'task-1' }) }),
    ]);
    expect(git.getBranches().map((branch) => branch.name)).toEqual([
      'main',
      'work/task-1-update-parser',
    ]);
    expect(git.getCommits().map((commit) => ({
      sequence: commit.sequence,
      branchName: commit.branchName,
      message: commit.message,
      payloadType: commit.content.type,
    }))).toEqual([
      { sequence: 0, branchName: 'main', message: 'Mail: user', payloadType: PayloadType.Mail },
      { sequence: 1, branchName: 'work/task-1-update-parser', message: 'Intent: task-1', payloadType: PayloadType.Intent },
    ]);
  });

  it('supports literal mock git branch, draft PR, review, decision, and merge operations', () => {
    const git = new MockGitRepository<string>({ now: clock(2_000) });
    const root = git.commit({ content: 'root', message: 'root', authorId: 'system' });
    git.createBranch('work/task-1', 'main');
    git.checkout('work/task-1');
    const pr = git.openDraftPullRequest({
      branchName: 'work/task-1',
      targetBranchName: 'main',
      title: 'Plan task-1',
      authorId: 'planner',
    });
    const intent = git.commit({ content: 'intent', message: 'intent(task-1): Update parser', authorId: 'planner' });

    git.markPullRequestReady(pr.id);
    git.voteOnPullRequest(pr.id, {
      voterId: 'trajectory-critic',
      vote: 'approve',
      reason: 'intent has a discrete work item',
    });
    git.decidePullRequest(pr.id, {
      deciderId: 'decider',
      decision: 'approved',
      reason: 'all voters approved',
    });
    const merge = git.mergePullRequest(pr.id, { authorId: 'decider', message: 'merge task-1 plan' });

    expect(git.getPullRequest(pr.id)).toEqual(expect.objectContaining({
      draft: false,
      state: 'merged',
      commitIds: [intent.id],
      reviews: [expect.objectContaining({ voterId: 'trajectory-critic', vote: 'approve' })],
      decision: expect.objectContaining({ decision: 'approved' }),
    }));
    expect(merge.parentIds).toEqual([root.id, intent.id]);
    expect(git.getBranch('main').headCommitId).toBe(merge.id);
    expect(git.getOperations().map((operation) => operation.type)).toEqual([
      'commit',
      'create-branch',
      'checkout',
      'open-draft-pr',
      'commit',
      'mark-pr-ready',
      'vote-pr',
      'decide-pr',
      'checkout',
      'merge-pr',
    ]);
  });

  it('tracks existing branch commits in draft PRs and rejects invalid mock git refs', () => {
    const git = new MockGitRepository<string>({ now: clock(3_000) });
    git.createBranch('work/task-2', 'main');
    git.checkout('work/task-2');
    const existing = git.commit({ content: 'intent', message: 'intent before PR', authorId: 'planner' });
    const pr = git.openDraftPullRequest({
      branchName: 'work/task-2',
      targetBranchName: 'main',
      title: 'Plan task-2',
      authorId: 'planner',
    });

    expect(git.currentBranch).toBe('work/task-2');
    expect(pr.commitIds).toEqual([existing.id]);
    expect(git.getPullRequests()).toEqual([expect.objectContaining({ id: pr.id })]);
    expect(() => git.createBranch('work/task-2', 'main')).toThrow('Branch already exists');
    expect(() => git.getBranch('missing')).toThrow('Unknown branch');
    expect(() => git.checkout('missing')).toThrow('Unknown branch');
    expect(() => git.getPullRequest('pr-missing')).toThrow('Unknown pull request');
    expect(() => git.voteOnPullRequest('pr-missing', { voterId: 'voter', vote: 'comment' })).toThrow('Unknown pull request');

    const empty = new MockGitRepository<string>({ now: clock(4_000) });
    empty.createBranch('empty-work', 'main');
    const emptyPr = empty.openDraftPullRequest({
      branchName: 'empty-work',
      targetBranchName: 'main',
      title: 'Empty work',
      authorId: 'planner',
    });
    expect(() => empty.mergePullRequest(emptyPr.id, { authorId: 'decider', message: 'merge empty' }))
      .toThrow('Cannot merge empty branch');
  });

  it('records feedback and rejected PR decisions and stops tracking commits after merge', () => {
    const git = new MockGitRepository<string>({ now: clock(4_500) });
    git.createBranch('work/feedback', 'main');
    git.checkout('work/feedback');
    const feedbackPr = git.openDraftPullRequest({
      branchName: 'work/feedback',
      targetBranchName: 'main',
      title: 'Feedback work',
      authorId: 'planner',
    });
    git.commit({ content: 'feedback-intent', message: 'feedback intent', authorId: 'planner' });
    git.decidePullRequest(feedbackPr.id, {
      deciderId: 'decider',
      decision: 'requires-feedback',
    });

    git.createBranch('work/rejected', 'main');
    git.checkout('work/rejected');
    const rejectedPr = git.openDraftPullRequest({
      branchName: 'work/rejected',
      targetBranchName: 'main',
      title: 'Rejected work',
      authorId: 'planner',
    });
    git.commit({ content: 'rejected-intent', message: 'rejected intent', authorId: 'planner' });
    git.decidePullRequest(rejectedPr.id, {
      deciderId: 'decider',
      decision: 'rejected',
    });

    git.createBranch('work/merged', 'main');
    git.checkout('work/merged');
    const mergedPr = git.openDraftPullRequest({
      branchName: 'work/merged',
      targetBranchName: 'main',
      title: 'Merged work',
      authorId: 'planner',
    });
    git.commit({ content: 'merged-intent', message: 'merged intent', authorId: 'planner' });
    git.mergePullRequest(mergedPr.id, { authorId: 'decider', message: 'merge work' });
    git.checkout('main');
    git.commit({ content: 'main-follow-up', message: 'main follow-up', authorId: 'system' });
    git.checkout('work/merged');
    git.commit({ content: 'branch-follow-up', message: 'branch follow-up', authorId: 'planner' });

    expect(git.getPullRequest(feedbackPr.id).state).toBe('feedback-required');
    expect(git.getPullRequest(rejectedPr.id).state).toBe('rejected');
    expect(git.getPullRequest(mergedPr.id).commitIds).toHaveLength(1);
  });

  it('merges into an empty target branch and guards against corrupted commit refs', () => {
    const git = new MockGitRepository<string>({ now: clock(5_000) });
    git.createBranch('work/task-3', 'main');
    git.checkout('work/task-3');
    const pr = git.openDraftPullRequest({
      branchName: 'work/task-3',
      targetBranchName: 'main',
      title: 'Plan task-3',
      authorId: 'planner',
    });
    const intent = git.commit({ content: 'intent', message: 'intent task-3', authorId: 'planner' });
    const merge = git.mergePullRequest(pr.id, { authorId: 'decider', message: 'merge into empty main' });
    expect(merge.parentIds).toEqual([intent.id]);

    const corrupted = new MockGitRepository<string>({ now: clock(6_000) });
    corrupted.createBranch('work/corrupted', 'main');
    const corruptedPr = corrupted.openDraftPullRequest({
      branchName: 'work/corrupted',
      targetBranchName: 'main',
      title: 'Corrupted work',
      authorId: 'planner',
    });
    (corrupted as unknown as { branches: Map<string, { headCommitId?: string }> })
      .branches.get('work/corrupted')!.headCommitId = 'missing-commit';
    expect(() => corrupted.mergePullRequest(corruptedPr.id, { authorId: 'decider', message: 'merge corrupted' }))
      .toThrow('Unknown commit');
  });
});

function clock(start: number): () => number {
  let now = start;
  return () => now++;
}
