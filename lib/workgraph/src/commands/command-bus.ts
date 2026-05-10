import { WorkGraphCommandError } from '../core/errors.js';
import { createSequentialWorkGraphIdFactory, type WorkGraphIdFactory } from '../core/ids.js';
import { actorCanDispatch } from '../core/permissions.js';
import { createSystemWorkGraphTimeSource, type WorkGraphTimeSource } from '../core/time.js';
import type { WorkGraphCommand, WorkGraphDispatchedEvent, WorkGraphProjectionState } from '../core/types.js';
import type { WorkGraphEventRepository } from '../events/event-store.js';
import { createWorkGraphEventFromCommand } from '../events/event-factory.js';
import { reduceWorkGraphEvents } from '../events/event-reducer.js';
import { validateWorkGraphCommand } from './validators.js';

export interface WorkGraph {
  dispatch(command: WorkGraphCommand): Promise<WorkGraphDispatchedEvent>;
  getSnapshot(): WorkGraphProjectionState;
  observe(listener: () => void): () => void;
}

export interface CreateWorkGraphOptions {
  repository: WorkGraphEventRepository;
  ids?: WorkGraphIdFactory;
  now?: WorkGraphTimeSource;
}

export function createWorkGraph(options: CreateWorkGraphOptions): WorkGraph {
  const ids = options.ids ?? createSequentialWorkGraphIdFactory();
  const now = options.now ?? createSystemWorkGraphTimeSource();
  let snapshot = reduceWorkGraphEvents(options.repository.getCachedEvents());
  const listeners = new Set<() => void>();
  options.repository.subscribe(() => {
    snapshot = reduceWorkGraphEvents(options.repository.getCachedEvents());
    emit();
  });

  return {
    async dispatch(command) {
      const valid = validateWorkGraphCommand(command);
      if (!actorCanDispatch(valid.actor, valid)) {
        throw new WorkGraphCommandError(`Actor ${valid.actor.id} cannot dispatch ${valid.type}`);
      }
      const event = createWorkGraphEventFromCommand(valid, snapshot, ids, now);
      await options.repository.appendEvents([event]);
      return { id: event.id, aggregateId: event.aggregateId };
    },
    getSnapshot() {
      return snapshot;
    },
    observe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function emit() {
    for (const listener of listeners) listener();
  }
}
