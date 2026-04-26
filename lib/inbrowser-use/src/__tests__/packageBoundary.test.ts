import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

function collectNamedExports(source: string): string[] {
  const directExports = Array.from(
    source.matchAll(/export\s+(?:class|function|const|let|var)\s+(\w+)/g),
    (match) => match[1],
  );
  const reExports = Array.from(
    source.matchAll(/export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g),
    (match) => match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/).pop() ?? '')
      .filter(Boolean),
  ).flat();

  return [...directExports, ...reExports].sort();
}

describe('package boundaries', () => {
  it('exposes the documented package entry point', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      exports?: Record<string, string>;
      main?: string;
      types?: string;
    };
    const indexSource = fs.readFileSync(path.join(packageRoot, 'src/index.ts'), 'utf8');
    const errorsSource = fs.readFileSync(path.join(packageRoot, 'src/errors.ts'), 'utf8');

    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect([
      ...collectNamedExports(indexSource),
      ...collectNamedExports(errorsSource),
    ].sort()).toEqual([
      'ActionExecutor',
      'ActionabilityEngine',
      'ActivationRequiredError',
      'AgentRegistry',
      'DefaultActivationBroker',
      'DefaultFrameChannelRegistry',
      'FrameNotCooperativeError',
      'FrameNotFoundError',
      'InAppError',
      'InAppFrameLocator',
      'InAppLocator',
      'InAppPage',
      'NotAttachedError',
      'NotEditableError',
      'NotEnabledError',
      'NotFoundError',
      'NotVisibleError',
      'ObscuredError',
      'QueryEngine',
      'RemoteRPCError',
      'RemoteRPCTimeoutError',
      'Runtime',
      'StabilityManager',
      'StrictModeViolationError',
      'TimeoutError',
      'UnsupportedError',
      'createInAppPage',
      'getSameOriginFrameDocument',
      'installFrameRPCHandler',
    ]);
  });

  it('documents and limits the published package surface', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      files?: string[];
    };

    expect(fs.existsSync(path.join(packageRoot, 'README.md'))).toBe(true);
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
