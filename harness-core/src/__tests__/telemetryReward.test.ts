import { afterEach, describe, expect, it, vi } from 'vitest';
import { trace, type Attributes, type Span } from '@opentelemetry/api';
import { recordActiveHarnessReward, setHarnessTelemetryReward } from '../index.js';

function createRecordingSpan(): { span: Span; attributes: Attributes } {
  const attributes: Attributes = {};
  const span = {
    setAttributes: (next: Attributes) => {
      Object.assign(attributes, next);
      return span;
    },
    spanContext: () => ({
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000001',
      traceFlags: 1,
    }),
  } as unknown as Span;
  return { span, attributes };
}

describe('setHarnessTelemetryReward', () => {
  it('writes additive reward.value and reward.source attributes', () => {
    const { span, attributes } = createRecordingSpan();

    setHarnessTelemetryReward(span, { value: 0.75, source: 'self-reflection' });

    expect(attributes).toEqual({
      'reward.value': 0.75,
      'reward.source': 'self-reflection',
    });
  });
});

describe('recordActiveHarnessReward', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false and records nothing when no span is active', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);
    expect(recordActiveHarnessReward({ value: 1, source: 'grader' })).toBe(false);
  });

  it('records the reward on the active span and returns true', () => {
    const { span, attributes } = createRecordingSpan();
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(span);

    const recorded = recordActiveHarnessReward({ value: 0.5, source: 'validation-contract' });

    expect(recorded).toBe(true);
    expect(attributes).toEqual({
      'reward.value': 0.5,
      'reward.source': 'validation-contract',
    });
  });
});
