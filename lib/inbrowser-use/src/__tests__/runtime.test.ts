import { describe, expect, it } from 'vitest';

import { TimeoutError } from '../errors.js';
import { retryUntil, Runtime } from '../runtime.js';

describe('retryUntil', () => {
  it('throws a timeout when retries fail without an Error instance', async () => {
    await expect(
      retryUntil(
        async () => {
          throw 'not ready';
        },
        1,
        1,
      ),
    ).rejects.toThrow(TimeoutError);
  });
});

describe('Runtime', () => {
  it('uses documented default options', () => {
    const runtime = new Runtime();

    expect(runtime.testIdAttribute).toBe('data-testid');
    expect(runtime.defaultTimeoutMs).toBe(5000);
    expect(runtime.stableFrames).toBe(2);
    expect(runtime.quietDomMs).toBe(75);
    expect(runtime.enableShadowDomTraversal).toBe(true);
  });
});
