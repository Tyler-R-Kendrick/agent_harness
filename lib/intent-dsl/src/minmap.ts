// Layer 2 of the intent DSL: the deterministic, reversible minifier (Token Sugar,
// arXiv:2512.08266). Emits a `<name>.min` document plus a `<name>.min.map` sidecar and
// guarantees the round-trip invariant `expand(minify(x)) === canonicalize(x)`. Promoted
// from research/token-sugar-2512.08266/experiments/experiment-01-min-map-roundtrip.ts.

export interface MinMapEntry {
  readonly id: number;
  readonly longForm: string;
  readonly shortForm: string;
}

export interface MinMap {
  readonly version: 1;
  readonly sourceName: string;
  readonly table: readonly MinMapEntry[];
  readonly positions: readonly number[];
}

export interface MinifiedDocument {
  readonly minName: string;
  readonly mapName: string;
  readonly min: string;
  readonly map: MinMap;
}

export interface SavingsReport {
  readonly sourceName: string;
  readonly canonicalChars: number;
  readonly minifiedChars: number;
  readonly approxTokensSaved: number;
  readonly roundTripOk: boolean;
}

const MIN_LONG_FORM_LENGTH = 5;

export function canonicalize(source: string): string {
  const tokens: string[] = [];
  for (const raw of source.split('\n').join(' ').split('\t').join(' ').split(' ')) {
    if (raw.length > 0) {
      tokens.push(raw);
    }
  }
  return tokens.join(' ');
}

// Quote-aware tokenizer: a double-quoted payload stays atomic (a single token),
// so quoted strings are never split word-by-word during minification.
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function isEligible(token: string): boolean {
  return token.length >= MIN_LONG_FORM_LENGTH && token[0] !== '"';
}

export function minify(sourceName: string, source: string): MinifiedDocument {
  const canonicalTokens = tokenize(canonicalize(source));
  const table: MinMapEntry[] = [];
  const idByLongForm = new Map<string, number>();
  const positions: number[] = [];
  const minTokens: string[] = [];

  for (const token of canonicalTokens) {
    if (!isEligible(token)) {
      positions.push(-1);
      minTokens.push(token);
      continue;
    }

    let id = idByLongForm.get(token);
    if (id === undefined) {
      id = table.length;
      idByLongForm.set(token, id);
      table.push({ id, longForm: token, shortForm: `~${id}` });
    }
    positions.push(id);
    minTokens.push(`~${id}`);
  }

  return {
    minName: `${sourceName}.min`,
    mapName: `${sourceName}.min.map`,
    min: minTokens.join(' '),
    map: { version: 1, sourceName, table, positions },
  };
}

export function expand(document: MinifiedDocument): string {
  if (document.map.version !== 1) {
    throw new Error(`unsupported .min.map version for ${document.mapName}`);
  }

  const minTokens = tokenize(document.min);
  if (minTokens.length !== document.map.positions.length) {
    throw new Error(`positional mapping does not cover ${document.minName}`);
  }

  const longForms: string[] = [];
  for (let index = 0; index < minTokens.length; index += 1) {
    const position = document.map.positions[index];
    if (position === -1) {
      longForms.push(minTokens[index]);
    } else {
      const entry = document.map.table[position];
      if (entry === undefined) {
        throw new Error(`missing table entry ${position} in ${document.mapName}`);
      }
      longForms.push(entry.longForm);
    }
  }
  return longForms.join(' ');
}

export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function verifyRoundTrip(sourceName: string, source: string): SavingsReport {
  const canonical = canonicalize(source);
  const document = minify(sourceName, source);
  const restored = expand(document);

  return {
    sourceName,
    canonicalChars: canonical.length,
    minifiedChars: document.min.length,
    approxTokensSaved: approximateTokens(canonical) - approximateTokens(document.min),
    roundTripOk: restored === canonical,
  };
}
