import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

function collectRootExports(source: string): string[] {
  return Array.from(
    source.matchAll(/^\s*export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"];?/gm),
    (match) => match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/).pop() ?? '')
      .filter(Boolean),
  ).flat().sort();
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

    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(packageJson.main).toBe('./src/index.ts');
    expect(packageJson.types).toBe('./src/index.ts');
    expect(collectRootExports(indexSource)).toEqual([
      'CrawlDecision',
      'CrawlDecisionLog',
      'CrawlTarget',
      'CrawlTargetKind',
      'EvidenceItem',
      'GapAnalyzer',
      'RecursiveResearchAgent',
      'RecursiveResearchAgentConfig',
      'RecursiveResearchEvent',
      'RecursiveResearchRequest',
      'RecursiveResearchResult',
      'ResearchBudget',
      'ResearchClaim',
      'ResearchGap',
      'ResearchGraph',
      'ResearchObjective',
      'ResearchTask',
      'ResearchToolset',
      'VisitedResource',
    ]);
  });

  it('documents and limits the published package surface', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      files?: string[];
    };
    const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8');

    expect(readme).toContain(
      "import { RecursiveResearchAgent } from '@agent-harness/recursive-research-agent';",
    );
    expect(readme).toContain('## Package Boundary');
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
