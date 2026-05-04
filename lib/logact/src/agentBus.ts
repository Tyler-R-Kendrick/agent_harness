import { PayloadType } from './types.js';
import type { AgentBusPayloadMeta, Entry, IAgentBus, Payload } from './types.js';
import { MockGitRepository } from './mockGit.js';

export interface GitAgentBusOptions {
  git?: MockGitRepository<Payload>;
}

/**
 * In-memory AgentBus implementation (arXiv 2604.07988 §3).
 *
 * A linearizable, durable, append-only shared log with typed entries and a
 * blocking poll API.  The "durable" property is best-effort in this
 * implementation (in-memory); production deployments should swap in an
 * SQLite or remote-log backend by implementing {@link IAgentBus}.
 */
export class GitAgentBus implements IAgentBus {
  readonly git: MockGitRepository<Payload>;
  /** Listeners waiting for specific payload types. */
  private readonly _listeners: Array<{
    start: number;
    filter: Set<PayloadType>;
    resolve: (entries: Entry[]) => void;
  }> = [];

  constructor(options: GitAgentBusOptions = {}) {
    this.git = options.git ?? new MockGitRepository<Payload>();
  }

  async append(payload: Payload): Promise<number> {
    const branchName = branchNameForPayload(payload);
    if (!this.git.hasBranch(branchName)) {
      this.git.createBranch(branchName, 'main');
    }
    if (this.git.currentBranch !== branchName) {
      this.git.checkout(branchName);
    }
    const commit = this.git.commit({
      content: payload,
      message: messageForPayload(payload),
      authorId: authorForPayload(payload),
      status: statusForPayload(payload),
    });
    this._notifyListeners();
    return commit.sequence;
  }

  async read(start: number, end: number): Promise<Entry[]> {
    return this._entries()
      .filter((entry) => entry.position >= start && entry.position < end);
  }

  async tail(): Promise<number> {
    return this._entries().length;
  }

  async poll(start: number, filter: PayloadType[]): Promise<Entry[]> {
    const filterSet = new Set(filter);
    // Check for already-available matching entries first.
    const immediate = this._entries()
      .filter((entry) => entry.position >= start)
      .filter((e) => filterSet.has(e.payload.type));
    if (immediate.length > 0) return immediate;

    // Otherwise register a listener and wait.
    return new Promise<Entry[]>((resolve) => {
      this._listeners.push({ start, filter: filterSet, resolve });
    });
  }

  // ----------------------------------------------------------------

  private _entries(): Entry[] {
    return this.git.getCommits()
      .map((commit) => ({
        position: commit.sequence,
        realtimeTs: commit.timestamp,
        payload: commit.content,
      }))
      .sort((left, right) => left.position - right.position);
  }

  private _notifyListeners(): void {
    // Iterate in reverse so splice doesn't affect indices.
    for (let i = this._listeners.length - 1; i >= 0; i--) {
      const listener = this._listeners[i];
      const matches = this._entries()
        .filter((entry) => entry.position >= listener.start)
        .filter((e) => listener.filter.has(e.payload.type));
      if (matches.length > 0) {
        this._listeners.splice(i, 1);
        listener.resolve(matches);
      }
    }
  }
}

export class InMemoryAgentBus extends GitAgentBus {}

function payloadMeta(payload: Payload): AgentBusPayloadMeta | undefined {
  return 'meta' in payload ? payload.meta : undefined;
}

function branchNameForPayload(payload: Payload): string {
  return payloadMeta(payload)?.branchId ?? 'main';
}

function authorForPayload(payload: Payload): string {
  return payloadMeta(payload)?.actorId ?? payloadMeta(payload)?.actorRole ?? 'agent';
}

function statusForPayload(payload: Payload): 'planned' | 'success' | 'error' | undefined {
  if (payload.type === PayloadType.Intent) return 'planned';
  if (payload.type === PayloadType.Result) return payload.error ? 'error' : 'success';
  return undefined;
}

function messageForPayload(payload: Payload): string {
  switch (payload.type) {
    case PayloadType.Mail:
      return `Mail: ${payload.from}`;
    case PayloadType.InfIn:
      return `InfIn: ${payload.messages.length} message${payload.messages.length === 1 ? '' : 's'}`;
    case PayloadType.InfOut:
      return 'InfOut';
    case PayloadType.Intent:
      return `Intent: ${payload.intentId}`;
    case PayloadType.Vote:
      return `Vote: ${payload.voterId}`;
    case PayloadType.Commit:
      return `Commit: ${payload.intentId}`;
    case PayloadType.Abort:
      return `Abort: ${payload.intentId}`;
    case PayloadType.Result:
      return `Result: ${payload.intentId}`;
    case PayloadType.Completion:
      return `Completion: ${payload.intentId}`;
    case PayloadType.Policy:
      return `Policy: ${payload.target}`;
  }
}
