import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../index';
import * as testingApi from '../testing/index';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const readPackageFile = (path: string) => readFileSync(resolve(packageRoot, path), 'utf8');

describe('package boundary', () => {
  it('documents stable public imports and private source modules', () => {
    const readme = readPackageFile('README.md');

    expect(readme).toContain('## Package Boundary');
    expect(readme).toContain("from '@agent-harness/lean-browser'");
    expect(readme).toContain("from '@agent-harness/lean-browser/testing'");
    expect(readme).toContain('@agent-harness/lean-browser/src/*');
  });

  it('publishes only package docs, Lean asset notes, and runtime TypeScript source', () => {
    const packageJson = JSON.parse(readPackageFile('package.json')) as {
      main: string;
      types: string;
      exports: Record<string, string>;
      files: string[];
      sideEffects: boolean;
    };

    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
      './testing': './src/testing/index.ts',
    });
    expect(packageJson.files).toEqual([
      'README.md',
      'public/lean/README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
    expect(packageJson.sideEffects).toBe(false);
  });

  it('keeps root and testing public APIs explicit', () => {
    expect(readPackageFile('src/index.ts')).not.toMatch(/export\s+\*\s+from/);
    expect(readPackageFile('src/testing/index.ts')).not.toMatch(/export\s+\*\s+from/);
  });

  it('exports the documented runtime values from the root entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'BrowserLeanChecker',
      'JsonPromptValidationModel',
      'agentResultSchema',
      'aggregateAttemptsPrompt',
      'applyUpdatedClaims',
      'buildLeanTheoremFile',
      'collectCheckerFeedback',
      'createArtifactStore',
      'createEmptySummaryState',
      'createLeanServer',
      'critiqueStepPrompt',
      'critiqueTracePrompt',
      'determineVerificationStatus',
      'extractFirstJsonObject',
      'findFailingRegions',
      'formalClaimSchema',
      'formalizeClaimPrompt',
      'formatLeanDiagnostics',
      'gateAnswerPrompt',
      'generateTracePrompt',
      'hasLeanErrors',
      'hasUnresolvedCriticalFailures',
      'normalizeLeanDiagnostic',
      'parseModelJson',
      'reasoningTraceSchema',
      'regionImproved',
      'repairRegionPrompt',
      'runAgentBrowser',
      'sanitizeLeanIdentifier',
      'spliceRepairedSteps',
      'stringifyForPrompt',
      'taskInputSchema',
      'updateSummaryState',
    ]);
  });

  it('exports test doubles only from the testing subpath', () => {
    expect(Object.keys(testingApi).sort()).toEqual([
      'FakeLeanChecker',
      'StubValidationModel',
    ]);
  });
});
