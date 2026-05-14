import { describe, expect, it } from 'vitest';
import { createInMemoryWorkGraphRepository, type WorkGraphEvent } from '../index.js';

const workspaceCreatedEvent: WorkGraphEvent = {
  id: 'event-1',
  type: 'workspace.created',
  aggregateId: 'workspace-1',
  aggregateType: 'workspace',
  actor: { type: 'user', id: 'user-1' },
  data: { name: 'Protected workspace', key: 'SAFE' },
  timestamp: '2026-05-14T12:00:00.000Z',
  commandId: 'event-1',
};

const injectedEvent: WorkGraphEvent = {
  ...workspaceCreatedEvent,
  id: 'injected-event',
  aggregateId: 'injected-workspace',
  commandId: 'injected-event',
};

describe('WorkGraph in-memory repository', () => {
  it('exposes immutable event sequences so callers cannot mutate append-only history', async () => {
    const repository = createInMemoryWorkGraphRepository();
    const appendedEvents = await repository.appendEvents([workspaceCreatedEvent]);
    expect(() => {
      appendedEvents.push(injectedEvent);
    }).toThrow(TypeError);

    const listedEvents = await repository.listEvents();
    expect(() => {
      listedEvents.push(injectedEvent);
    }).toThrow(TypeError);
    expect((await repository.listEvents()).map((event) => event.id)).toEqual(['event-1']);

    const cachedEvents = repository.getCachedEvents();
    expect(() => {
      cachedEvents.splice(0, 1);
    }).toThrow(TypeError);
    expect(repository.getCachedEvents().map((event) => event.id)).toEqual(['event-1']);
  });
});
