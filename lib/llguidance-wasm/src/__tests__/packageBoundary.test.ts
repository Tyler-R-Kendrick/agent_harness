import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json' with { type: 'json' };
import * as publicApi from '../index.js';

describe('package boundary', () => {
  it('exports the browser-safe public API', () => {
    expect(packageJson.name).toBe('@agent-harness/llguidance-wasm');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './worker': './src/worker.ts',
      './worker-client': './src/worker-client.ts'
    });
    expect(publicApi).toEqual(expect.objectContaining({
      LlguidanceLogitsMasker: expect.any(Function),
      LlguidanceSession: expect.any(Function),
      TokenMaskApplier: expect.any(Function),
      applyAllowedTokenMaskInPlace: expect.any(Function),
      initLlguidanceWasm: expect.any(Function)
    }));
  });
});
