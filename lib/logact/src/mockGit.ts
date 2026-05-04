export type MockGitCommitStatus = 'planned' | 'running' | 'success' | 'error' | 'feedback';

export interface MockGitCommit<TContent = unknown> {
  id: string;
  sequence: number;
  branchName: string;
  parentIds: string[];
  message: string;
  authorId: string;
  content: TContent;
  timestamp: number;
  status?: MockGitCommitStatus;
}

export interface MockGitBranch {
  name: string;
  headCommitId?: string;
  createdAt: number;
}

export type MockPullRequestState =
  | 'draft'
  | 'ready'
  | 'approved'
  | 'feedback-required'
  | 'rejected'
  | 'merged';

export type MockPullRequestVote = 'approve' | 'request-changes' | 'reject' | 'comment';

export interface MockPullRequestReview {
  voterId: string;
  vote: MockPullRequestVote;
  reason?: string;
}

export interface MockPullRequestDecision {
  deciderId: string;
  decision: 'approved' | 'requires-feedback' | 'rejected';
  reason?: string;
}

export interface MockPullRequest {
  id: string;
  title: string;
  branchName: string;
  targetBranchName: string;
  authorId: string;
  draft: boolean;
  state: MockPullRequestState;
  commitIds: string[];
  reviews: MockPullRequestReview[];
  decision?: MockPullRequestDecision;
  createdAt: number;
  updatedAt: number;
}

export interface MockGitOperation {
  type:
    | 'commit'
    | 'create-branch'
    | 'checkout'
    | 'open-draft-pr'
    | 'mark-pr-ready'
    | 'vote-pr'
    | 'decide-pr'
    | 'merge-pr';
  timestamp: number;
  branchName?: string;
  commitId?: string;
  pullRequestId?: string;
}

export interface MockGitRepositoryOptions {
  now?: () => number;
}

export class MockGitRepository<TContent = unknown> {
  private readonly now: () => number;
  private commitSeq = 0;
  private prSeq = 0;
  private currentBranchName = 'main';
  private readonly branches = new Map<string, MockGitBranch>();
  private readonly commits = new Map<string, MockGitCommit<TContent>>();
  private readonly pullRequests = new Map<string, MockPullRequest>();
  private readonly operations: MockGitOperation[] = [];

  constructor(options: MockGitRepositoryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.branches.set('main', { name: 'main', createdAt: 0 });
  }

  get currentBranch(): string {
    return this.currentBranchName;
  }

  hasBranch(name: string): boolean {
    return this.branches.has(name);
  }

  getBranch(name: string): MockGitBranch {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Unknown branch: ${name}`);
    }
    return { ...branch };
  }

  getBranches(): MockGitBranch[] {
    return [...this.branches.values()].map((branch) => ({ ...branch }));
  }

  getCommits(): MockGitCommit<TContent>[] {
    return [...this.commits.values()].map((commit) => ({ ...commit, parentIds: [...commit.parentIds] }));
  }

  getPullRequest(id: string): MockPullRequest {
    const pullRequest = this.pullRequests.get(id);
    if (!pullRequest) {
      throw new Error(`Unknown pull request: ${id}`);
    }
    return clonePullRequest(pullRequest);
  }

  getPullRequests(): MockPullRequest[] {
    return [...this.pullRequests.values()].map(clonePullRequest);
  }

  getOperations(): MockGitOperation[] {
    return this.operations.map((operation) => ({ ...operation }));
  }

  createBranch(name: string, fromBranchName = this.currentBranchName): MockGitBranch {
    if (this.branches.has(name)) {
      throw new Error(`Branch already exists: ${name}`);
    }
    const fromBranch = this.requireBranch(fromBranchName);
    const branch: MockGitBranch = {
      name,
      headCommitId: fromBranch.headCommitId,
      createdAt: this.now(),
    };
    this.branches.set(name, branch);
    this.record({ type: 'create-branch', branchName: name });
    return { ...branch };
  }

  checkout(branchName: string): MockGitBranch {
    const branch = this.requireBranch(branchName);
    this.currentBranchName = branchName;
    this.record({ type: 'checkout', branchName });
    return { ...branch };
  }

  commit(input: {
    content: TContent;
    message: string;
    authorId: string;
    status?: MockGitCommitStatus;
  }): MockGitCommit<TContent> {
    const branch = this.requireBranch(this.currentBranchName);
    const parentIds = branch.headCommitId ? [branch.headCommitId] : [];
    const commit = this.createCommit({
      branchName: branch.name,
      parentIds,
      content: input.content,
      message: input.message,
      authorId: input.authorId,
      status: input.status,
    });
    branch.headCommitId = commit.id;
    this.branches.set(branch.name, branch);
    this.attachCommitToOpenPullRequests(commit);
    this.record({ type: 'commit', branchName: branch.name, commitId: commit.id });
    return commit;
  }

  openDraftPullRequest(input: {
    branchName: string;
    targetBranchName: string;
    title: string;
    authorId: string;
  }): MockPullRequest {
    this.requireBranch(input.branchName);
    this.requireBranch(input.targetBranchName);
    const id = `pr-${++this.prSeq}`;
    const pullRequest: MockPullRequest = {
      id,
      title: input.title,
      branchName: input.branchName,
      targetBranchName: input.targetBranchName,
      authorId: input.authorId,
      draft: true,
      state: 'draft',
      commitIds: this.commitsForBranch(input.branchName),
      reviews: [],
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.pullRequests.set(id, pullRequest);
    this.record({ type: 'open-draft-pr', branchName: input.branchName, pullRequestId: id });
    return clonePullRequest(pullRequest);
  }

  markPullRequestReady(id: string): MockPullRequest {
    const pullRequest = this.requirePullRequest(id);
    pullRequest.draft = false;
    pullRequest.state = 'ready';
    pullRequest.updatedAt = this.now();
    this.record({ type: 'mark-pr-ready', pullRequestId: id });
    return clonePullRequest(pullRequest);
  }

  voteOnPullRequest(id: string, review: MockPullRequestReview): MockPullRequest {
    const pullRequest = this.requirePullRequest(id);
    pullRequest.reviews.push({ ...review });
    pullRequest.updatedAt = this.now();
    this.record({ type: 'vote-pr', pullRequestId: id });
    return clonePullRequest(pullRequest);
  }

  decidePullRequest(id: string, decision: MockPullRequestDecision): MockPullRequest {
    const pullRequest = this.requirePullRequest(id);
    pullRequest.decision = { ...decision };
    pullRequest.state = decision.decision === 'approved'
      ? 'approved'
      : decision.decision === 'requires-feedback'
        ? 'feedback-required'
        : 'rejected';
    pullRequest.updatedAt = this.now();
    this.record({ type: 'decide-pr', pullRequestId: id });
    return clonePullRequest(pullRequest);
  }

  mergePullRequest(id: string, input: { authorId: string; message: string }): MockGitCommit<TContent> {
    const pullRequest = this.requirePullRequest(id);
    const sourceBranch = this.requireBranch(pullRequest.branchName);
    if (!sourceBranch.headCommitId) {
      throw new Error(`Cannot merge empty branch: ${pullRequest.branchName}`);
    }
    const targetBranch = this.requireBranch(pullRequest.targetBranchName);
    this.checkout(targetBranch.name);
    const sourceCommit = this.requireCommit(sourceBranch.headCommitId);
    const parentIds = targetBranch.headCommitId
      ? [targetBranch.headCommitId, sourceCommit.id]
      : [sourceCommit.id];
    const mergeCommit = this.createCommit({
      branchName: targetBranch.name,
      parentIds,
      content: sourceCommit.content,
      message: input.message,
      authorId: input.authorId,
      status: sourceCommit.status,
    });
    targetBranch.headCommitId = mergeCommit.id;
    this.branches.set(targetBranch.name, targetBranch);
    pullRequest.state = 'merged';
    pullRequest.draft = false;
    pullRequest.updatedAt = this.now();
    this.record({ type: 'merge-pr', branchName: targetBranch.name, commitId: mergeCommit.id, pullRequestId: id });
    return mergeCommit;
  }

  private commitsForBranch(branchName: string): string[] {
    return this.getCommits()
      .filter((commit) => commit.branchName === branchName)
      .map((commit) => commit.id);
  }

  private attachCommitToOpenPullRequests(commit: MockGitCommit<TContent>): void {
    for (const pullRequest of this.pullRequests.values()) {
      if (pullRequest.branchName === commit.branchName && pullRequest.state !== 'merged') {
        pullRequest.commitIds.push(commit.id);
        pullRequest.updatedAt = this.now();
      }
    }
  }

  private createCommit(input: {
    branchName: string;
    parentIds: string[];
    content: TContent;
    message: string;
    authorId: string;
    status?: MockGitCommitStatus;
  }): MockGitCommit<TContent> {
    const commit: MockGitCommit<TContent> = {
      id: `c-${++this.commitSeq}`,
      sequence: this.commitSeq - 1,
      branchName: input.branchName,
      parentIds: [...input.parentIds],
      message: input.message,
      authorId: input.authorId,
      content: input.content,
      timestamp: this.now(),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    this.commits.set(commit.id, commit);
    return commit;
  }

  private requireBranch(name: string): MockGitBranch {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Unknown branch: ${name}`);
    }
    return branch;
  }

  private requireCommit(id: string): MockGitCommit<TContent> {
    const commit = this.commits.get(id);
    if (!commit) {
      throw new Error(`Unknown commit: ${id}`);
    }
    return commit;
  }

  private requirePullRequest(id: string): MockPullRequest {
    const pullRequest = this.pullRequests.get(id);
    if (!pullRequest) {
      throw new Error(`Unknown pull request: ${id}`);
    }
    return pullRequest;
  }

  private record(operation: Omit<MockGitOperation, 'timestamp'>): void {
    this.operations.push({ ...operation, timestamp: this.now() });
  }
}

function clonePullRequest(pullRequest: MockPullRequest): MockPullRequest {
  return {
    ...pullRequest,
    commitIds: [...pullRequest.commitIds],
    reviews: pullRequest.reviews.map((review) => ({ ...review })),
    ...(pullRequest.decision !== undefined ? { decision: { ...pullRequest.decision } } : {}),
  };
}
