import type { WorkGraphProjectionState } from '../core/types.js';
import type { WorkGraphEvent } from '../events/types.js';
import { reduceWorkGraphEvents } from '../events/event-reducer.js';

export function materializeWorkGraphProjection(events: WorkGraphEvent[]): WorkGraphProjectionState {
  return reduceWorkGraphEvents(events);
}
