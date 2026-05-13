import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../../package.json' with { type: 'json' };
import * as publicApi from '../index.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readPackageFile(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('package boundary', () => {
  it('documents the stable package import boundaries', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package boundary');
    expect(readme).toContain("import { LlguidanceSession } from '@agent-harness/llguidance-wasm'");
    expect(readme).toContain("import { LlguidanceWorkerClient } from '@agent-harness/llguidance-wasm/worker-client'");
    expect(readme).toContain('@agent-harness/llguidance-wasm/src/*');
  });

  it('exports the browser-safe public API', () => {
    expect(packageJson.name).toBe('@agent-harness/llguidance-wasm');
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**'
    ]);
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
