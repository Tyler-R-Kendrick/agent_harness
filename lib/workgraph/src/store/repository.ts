import { deepFreeze } from '../events/event-reducer.js';
import type { WorkGraphEventRepository } from '../events/event-store.js';
import type { WorkGraphEvent } from '../events/types.js';

export function createInMemoryWorkGraphRepository(initialEvents: WorkGraphEvent[] = []): WorkGraphEventRepository {
  let events = freezeEvents(initialEvents);
  const listeners = new Set<() => void>();

  return {
    async appendEvents(nextEvents) {
      const frozen = freezeEvents(nextEvents);
      events = freezeEventList([...events, ...frozen]);
      emit();
      return frozen;
    },
    async listEvents() {
      return events;
    },
    getCachedEvents() {
      return events;
    },
    async replaceEvents(nextEvents) {
      events = freezeEvents(nextEvents);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function emit() {
    for (const listener of listeners) listener();
  }
}

export function freezeEvents(events: WorkGraphEvent[]): WorkGraphEvent[] {
  return freezeEventList(
    events.map((event) => deepFreeze({ ...event, actor: { ...event.actor }, data: { ...event.data } })),
  );
}

function freezeEventList(events: WorkGraphEvent[]): WorkGraphEvent[] {
  return Object.freeze(events) as WorkGraphEvent[];
}
