import type { WorkGraphEvent } from '../events/types.js';

export interface WorkGraphTransaction {
  events: WorkGraphEvent[];
}
