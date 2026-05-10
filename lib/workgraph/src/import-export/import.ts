import type { WorkGraphEventRepository } from '../events/event-store.js';
import type { WorkGraphExportPayload } from './export.js';

export async function importWorkGraph(repository: WorkGraphEventRepository, payload: WorkGraphExportPayload): Promise<void> {
  if (payload.version !== 1) {
    throw new Error(`Unsupported WorkGraph export version ${String(payload.version)}`);
  }
  await repository.replaceEvents(payload.events);
}
