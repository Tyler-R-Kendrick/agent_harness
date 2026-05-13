import { describe, expect, it } from 'vitest';
import { TokenMaskApplier, applyAllowedTokenMaskInPlace } from '../mask.js';

describe('mask helpers', () => {
  it('sets disallowed logits to negative infinity for arrays and typed arrays', () => {
    const dense = [0.1, 0.2, 0.3, 0.4];
    applyAllowedTokenMaskInPlace(dense, new Uint32Array([1, 3, 99]));
    expect(dense).toEqual([-Infinity, 0.2, -Infinity, 0.4]);

    const typed = new Float32Array([1, 2, 3]);
    applyAllowedTokenMaskInPlace(typed, new Uint32Array([0]));
    expect([...typed]).toEqual([1, -Infinity, -Infinity]);
  });

  it('reuses marker storage across generations', () => {
    const applier = new TokenMaskApplier(4);
    const first = [1, 2, 3, 4];
    const second = [5, 6, 7, 8];

    applier.apply(first, new Uint32Array([0, 2]));
    applier.apply(second, new Uint32Array([1]));

    expect(first).toEqual([1, -Infinity, 3, -Infinity]);
    expect(second).toEqual([-Infinity, 6, -Infinity, -Infinity]);
  });

  it('resets marker storage when the generation counter wraps', () => {
    const applier = new TokenMaskApplier(3);
    (applier as unknown as { generation: number }).generation = 0xfffffffe;
    const logits = [1, 2, 3];

    applier.apply(logits, new Uint32Array([2]));

    expect(logits).toEqual([-Infinity, -Infinity, 3]);
    expect((applier as unknown as { generation: number }).generation).toBe(1);
  });

  it('ignores allowed token ids outside the marker storage range', () => {
    const applier = new TokenMaskApplier(2);
    const logits = [1, 2];

    applier.apply(logits, new Uint32Array([0, 99]));

    expect(logits).toEqual([1, -Infinity]);
  });
});
