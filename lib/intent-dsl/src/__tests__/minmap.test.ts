import { describe, expect, it } from 'vitest';
import {
  approximateTokens,
  canonicalize,
  expand,
  minify,
  tokenize,
  verifyRoundTrip,
  type MinifiedDocument,
} from '../minmap';

const FIXTURES: readonly { readonly name: string; readonly source: string }[] = [
  {
    name: 'workspace-plan',
    source:
      'use-dsl intent-v1 ; discover-harness agent-browser ; emit workspace-plan "open research workspace" ; verify workspace-plan ;',
  },
  {
    name: 'grammar-refresh',
    source:
      'use-dsl intent-v1 ; emit grammar-refresh "rebuild lark grammar terminals" ; emit grammar-refresh "register constrained decoding hook" ; verify grammar-refresh ;',
  },
  {
    name: 'budget-audit',
    source:
      'use-dsl intent-v1 ; discover-harness prompt-budget ; emit budget-audit "account minified savings" ; verify budget-audit ;',
  },
];

describe('canonicalize', () => {
  it('normalizes whitespace and drops empty tokens', () => {
    expect(canonicalize('  use-dsl\n\tintent-v1  ')).toBe('use-dsl intent-v1');
  });
});

describe('tokenize', () => {
  it('skips repeated and trailing whitespace outside quotes', () => {
    expect(tokenize('a  b ')).toEqual(['a', 'b']);
  });

  it('keeps a quoted payload atomic and emits a trailing bare token', () => {
    expect(tokenize('"x y" z')).toEqual(['"x y"', 'z']);
  });
});

describe('minify', () => {
  it('reuses a single map id for a repeated long-form token', () => {
    const document = minify('grammar-refresh', FIXTURES[1].source);
    const grammarRefreshEntries = document.map.table.filter(
      (entry) => entry.longForm === 'grammar-refresh',
    );

    expect(grammarRefreshEntries).toHaveLength(1);
    expect(document.minName).toBe('grammar-refresh.min');
    expect(document.mapName).toBe('grammar-refresh.min.map');
    expect(document.map.version).toBe(1);
  });

  it('leaves short and quoted tokens untouched (ineligible for the map)', () => {
    const document = minify('workspace-plan', FIXTURES[0].source);

    expect(document.map.table.some((entry) => entry.longForm === 'emit')).toBe(false);
    expect(document.map.table.some((entry) => entry.longForm.startsWith('"'))).toBe(false);
    expect(document.min).toContain('emit');
    expect(document.min).toContain('"open research workspace"');
  });
});

describe('round-trip invariant', () => {
  it.each(FIXTURES)('expand(minify(x)) === canonicalize(x) for $name', ({ name, source }) => {
    const document = minify(name, source);
    expect(expand(document)).toBe(canonicalize(source));
  });

  it('reports positive token savings and a passing round trip', () => {
    for (const { name, source } of FIXTURES) {
      const report = verifyRoundTrip(name, source);
      expect(report.roundTripOk).toBe(true);
      expect(report.sourceName).toBe(name);
      expect(report.approxTokensSaved).toBeGreaterThan(0);
      expect(report.canonicalChars).toBe(canonicalize(source).length);
    }
  });
});

describe('approximateTokens', () => {
  it('estimates one token per four characters, rounded up', () => {
    expect(approximateTokens('')).toBe(0);
    expect(approximateTokens('abcde')).toBe(2);
  });
});

describe('expand failure modes', () => {
  const base = minify('workspace-plan', FIXTURES[0].source);

  it('rejects an unsupported map version', () => {
    const broken = { ...base, map: { ...base.map, version: 2 } } as unknown as MinifiedDocument;
    expect(() => expand(broken)).toThrow(/unsupported .min.map version/);
  });

  it('rejects a positional mapping that does not cover the document', () => {
    const broken: MinifiedDocument = {
      ...base,
      map: { ...base.map, positions: [...base.map.positions, 0] },
    };
    expect(() => expand(broken)).toThrow(/positional mapping does not cover/);
  });

  it('rejects a position that references a missing table entry', () => {
    const broken: MinifiedDocument = {
      minName: 'orphan.min',
      mapName: 'orphan.min.map',
      min: '~0',
      map: { version: 1, sourceName: 'orphan', table: [], positions: [0] },
    };
    expect(() => expand(broken)).toThrow(/missing table entry 0/);
  });
});
