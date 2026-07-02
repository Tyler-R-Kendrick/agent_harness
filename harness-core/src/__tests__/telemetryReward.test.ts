import { describe, expect, it } from 'vitest';
import type { Attributes, Span } from '@opentelemetry/api';
import { setHarnessTelemetryReward } from '../index.js';

function createRecordingSpan(): { span: Span; attributes: Attributes } {
  const attributes: Attributes = {};
  const span = {
    setAttributes: (next: Attributes) => {
      Object.assign(attributes, next);
      return span;
    },
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
