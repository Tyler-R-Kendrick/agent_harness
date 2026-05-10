import type { WorkGraphEvent } from './types.js';

export interface WorkGraphEventRepository {
  appendEvents(events: WorkGraphEvent[]): Promise<WorkGraphEvent[]>;
  listEvents(): Promise<WorkGraphEvent[]>;
  getCachedEvents(): WorkGraphEvent[];
  replaceEvents(events: WorkGraphEvent[]): Promise<void>;
  subscribe(listener: () => void): () => void;
}
