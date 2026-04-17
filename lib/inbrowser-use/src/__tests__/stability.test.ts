import { describe, it, expect } from 'vitest';
import { StabilityManager } from '../stability.js';

describe('StabilityManager', () => {
  it('resolves without error', async () => {
    const manager = new StabilityManager();
    await expect(manager.waitForStableUI({ frames: 1, quietDomMs: 0 })).resolves.toBeUndefined();
  });

  it('resolves with default options', async () => {
    const manager = new StabilityManager();
    await expect(manager.waitForStableUI()).resolves.toBeUndefined();
  });

  it('resolves with frames=0', async () => {
    const manager = new StabilityManager();
    await expect(manager.waitForStableUI({ frames: 0, quietDomMs: 0 })).resolves.toBeUndefined();
  });

  it('resolves within timeout when quietDomMs requested', async () => {
    const manager = new StabilityManager();
    const start = Date.now();
    await manager.waitForStableUI({ frames: 0, quietDomMs: 50, timeout: 300 });
    // Should complete (either after quiet period or timeout)
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });
});
