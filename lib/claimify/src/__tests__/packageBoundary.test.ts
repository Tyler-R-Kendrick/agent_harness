import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import packageJson from '../../package.json' with { type: 'json' };
import * as publicApi from '../index';

describe('package boundary', () => {
  it('documents and protects the stable import surface', async () => {
    expect(packageJson.name).toBe('@agent-harness/claimify');
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './worker-client': './src/worker-client.ts',
      './worker': './src/worker.ts',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);

    const readme = await readFile(join(process.cwd(), 'README.md'), 'utf8');
    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain('@agent-harness/claimify');
    expect(readme).toContain('@agent-harness/claimify/worker-client');
    expect(readme).toContain('@agent-harness/claimify/worker');
    expect(readme).toContain('@agent-harness/claimify/src/*');
  });

  it('keeps the root entry point explicit', () => {
    expect(publicApi).toEqual(expect.objectContaining({
      BrowserClaimExtractor: expect.any(Function),
      ClaimifyAbortError: expect.any(Function),
      ClaimifyError: expect.any(Function),
      ClaimifyJsonError: expect.any(Function),
      ClaimifyModelError: expect.any(Function),
      ClaimifyValidationError: expect.any(Function),
      ClaimifyWorkerError: expect.any(Function),
      buildDecompositionPrompt: expect.any(Function),
      buildDisambiguationPrompt: expect.any(Function),
      buildExcerpt: expect.any(Function),
      buildSelectionPrompt: expect.any(Function),
      createClaimifyWorkerExtractor: expect.any(Function),
      deduplicateClaims: expect.any(Function),
      isAcceptableClaim: expect.any(Function),
      normalizeClaim: expect.any(Function),
      splitSentences: expect.any(Function),
      validateClaim: expect.any(Function),
    }));
    expect(Object.keys(publicApi).sort()).toEqual([
      'BrowserClaimExtractor',
      'ClaimifyAbortError',
      'ClaimifyError',
      'ClaimifyJsonError',
      'ClaimifyModelError',
      'ClaimifyValidationError',
      'ClaimifyWorkerError',
      'buildDecompositionPrompt',
      'buildDisambiguationPrompt',
      'buildExcerpt',
      'buildSelectionPrompt',
      'createClaimifyWorkerExtractor',
      'deduplicateClaims',
      'isAcceptableClaim',
      'normalizeClaim',
      'splitSentences',
      'validateClaim',
    ]);
  });
});
