import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayloadType } from 'logact';
import { createObservedBus } from './observedAgentBus';

describe('observedAgentBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mirrors callback entries with the same timestamp stamped in the AgentBus', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_000);
    const onBusEntry = vi.fn();
    const bus = createObservedBus(onBusEntry);

    const position = await bus.append({
      type: PayloadType.Mail,
      from: 'user',
      content: 'Run the regression tests.',
    });
    const [storedEntry] = await bus.read(position, position + 1);

    expect(storedEntry?.realtimeTs).toBe(1_000);
    expect(onBusEntry).toHaveBeenCalledWith({
      id: 'bus-0',
      position: 0,
      realtimeTs: 1_000,
      payloadType: PayloadType.Mail,
      summary: 'Mail · user',
      detail: 'Run the regression tests.',
      actor: 'user',
    });
  });
});
