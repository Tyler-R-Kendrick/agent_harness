import type { WorkGraphEventRepository } from '../events/event-store.js';
import type { WorkGraphEvent } from '../events/types.js';

export interface WorkGraphExportPayload {
  version: 1;
  exportedAt: string;
  events: WorkGraphEvent[];
}

export async function exportWorkGraph(repository: WorkGraphEventRepository, exportedAt = new Date(0).toISOString()): Promise<WorkGraphExportPayload> {
  return {
    version: 1,
    exportedAt,
    events: await repository.listEvents(),
  };
}
