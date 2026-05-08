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
});
