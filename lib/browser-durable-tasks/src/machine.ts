import { createActor, createMachine } from 'xstate';
import type { DurableTaskStatus } from './types.js';

export type DurableTaskMachineEvent =
  | 'START'
  | 'WAIT'
  | 'RESUME'
  | 'COMPLETE'
  | 'FAIL_RETRYABLE'
  | 'FAIL_FINAL'
  | 'CANCEL'
  | 'RETRY';

export interface DurableTaskMachineModel {
  initialState: DurableTaskStatus;
  machine: ReturnType<typeof createMachine>;
}

export function createDurableTaskMachine(initialState: DurableTaskStatus = 'queued'): DurableTaskMachineModel {
  return {
    initialState,
    machine: createMachine({
      id: 'durableTask',
      initial: initialState,
      states: {
        queued: {
          on: {
            START: 'running',
            CANCEL: 'cancelled',
          },
        },
        running: {
          on: {
            WAIT: 'waiting',
            COMPLETE: 'completed',
            FAIL_RETRYABLE: 'queued',
            FAIL_FINAL: 'failed',
            CANCEL: 'cancelled',
          },
        },
        waiting: {
          on: {
            RESUME: 'queued',
            CANCEL: 'cancelled',
          },
        },
        failed: {
          on: {
            RETRY: 'queued',
            CANCEL: 'cancelled',
          },
        },
        completed: {
          type: 'final',
        },
        cancelled: {
          type: 'final',
        },
      },
    }),
  };
}

export function transitionDurableTaskStatus(
  status: DurableTaskStatus,
  eventType: DurableTaskMachineEvent,
): DurableTaskStatus {
  const { machine } = createDurableTaskMachine(status);
  const actor = createActor(machine);
  actor.start();
  actor.send({ type: eventType });
  return actor.getSnapshot().value as DurableTaskStatus;
}
