import Dexie, { type EntityTable } from 'dexie';
import type { WorkGraphEvent } from '../events/types.js';

export interface WorkGraphDexieEventRecord extends WorkGraphEvent {
  workspaceKey: string;
}

export class WorkGraphDexieDatabase extends Dexie {
  events!: EntityTable<WorkGraphDexieEventRecord, 'id'>;

  constructor(name = 'agent-harness-workgraph') {
    super(name);
    this.version(1).stores({
      events: '&id, workspaceKey, aggregateId, type, timestamp',
    });
  }
}
