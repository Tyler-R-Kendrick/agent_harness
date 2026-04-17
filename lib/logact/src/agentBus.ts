import type { Entry, IAgentBus, Payload, PayloadType } from './types.js';

/**
 * In-memory AgentBus implementation (arXiv 2604.07988 §3).
 *
 * A linearizable, durable, append-only shared log with typed entries and a
 * blocking poll API.  The "durable" property is best-effort in this
 * implementation (in-memory); production deployments should swap in an
 * SQLite or remote-log backend by implementing {@link IAgentBus}.
 */
export class InMemoryAgentBus implements IAgentBus {
  private readonly _entries: Entry[] = [];
  /** Listeners waiting for specific payload types. */
  private readonly _listeners: Array<{
    start: number;
    filter: Set<PayloadType>;
    resolve: (entries: Entry[]) => void;
  }> = [];

  async append(payload: Payload): Promise<number> {
    const entry: Entry = {
      position: this._entries.length,
      realtimeTs: Date.now(),
      payload,
    };
    this._entries.push(entry);
    this._notifyListeners();
    return entry.position;
  }

  async read(start: number, end: number): Promise<Entry[]> {
    return this._entries.slice(start, end);
  }

  async tail(): Promise<number> {
    return this._entries.length;
  }

  async poll(start: number, filter: PayloadType[]): Promise<Entry[]> {
    const filterSet = new Set(filter);
    // Check for already-available matching entries first.
    const immediate = this._entries
      .slice(start)
      .filter((e) => filterSet.has(e.payload.type));
    if (immediate.length > 0) return immediate;

    // Otherwise register a listener and wait.
    return new Promise<Entry[]>((resolve) => {
      this._listeners.push({ start, filter: filterSet, resolve });
    });
  }

  // ----------------------------------------------------------------

  private _notifyListeners(): void {
    // Iterate in reverse so splice doesn't affect indices.
    for (let i = this._listeners.length - 1; i >= 0; i--) {
      const listener = this._listeners[i];
      const matches = this._entries
        .slice(listener.start)
        .filter((e) => listener.filter.has(e.payload.type));
      if (matches.length > 0) {
        this._listeners.splice(i, 1);
        listener.resolve(matches);
      }
    }
  }
}
