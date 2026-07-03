// Layer 1 of the intent DSL: the canonical, unambiguous form (Anka, arXiv:2512.23214).
// One way to say each thing, explicit naming, no optional syntax variants. This module
// tokenizes and parses the canonical form and emits the Lark grammar the constrained
// decoder registers. Promoted from
// research/anka-2512.23214/experiments/experiment-01-canonical-intent-grammar.ts.

export type IntentStatement =
  | { readonly kind: 'discover-harness'; readonly target: string }
  | { readonly kind: 'use-dsl'; readonly dialect: string }
  | { readonly kind: 'emit'; readonly artifact: string; readonly payload: string }
  | { readonly kind: 'verify'; readonly artifact: string };

export interface IntentProgram {
  readonly statements: readonly IntentStatement[];
}

export type TokenKind = 'word' | 'string' | 'terminator';

export interface Token {
  readonly kind: TokenKind;
  readonly value: string;
}

export type ParseResult =
  | { readonly ok: true; readonly program: IntentProgram }
  | { readonly ok: false; readonly errors: readonly string[] };

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === ' ' || char === '\n' || char === '\t') {
      index += 1;
    } else if (char === ';') {
      tokens.push({ kind: 'terminator', value: ';' });
      index += 1;
    } else if (char === '"') {
      let end = index + 1;
      while (end < source.length && source[end] !== '"') {
        end += 1;
      }
      tokens.push({ kind: 'string', value: source.slice(index + 1, end) });
      index = end + 1;
    } else {
      let end = index;
      while (end < source.length && !' \n\t;"'.includes(source[end])) {
        end += 1;
      }
      tokens.push({ kind: 'word', value: source.slice(index, end) });
      index = end;
    }
  }

  return tokens;
}

export function parseIntentProgram(source: string): ParseResult {
  const tokens = tokenize(source);
  const errors: string[] = [];
  const statements: IntentStatement[] = [];
  let cursor = 0;

  const take = (kind: TokenKind): Token | undefined => {
    const token = tokens[cursor];
    if (token !== undefined && token.kind === kind) {
      cursor += 1;
      return token;
    }
    return undefined;
  };

  while (cursor < tokens.length && errors.length === 0) {
    const at = `statement ${statements.length + 1}`;
    const head = take('word');
    if (head === undefined) {
      errors.push(`${at}: expected a canonical keyword`);
      break;
    }

    if (head.value === 'discover-harness') {
      const target = take('word');
      if (target === undefined) errors.push(`${at}: discover-harness requires a target word`);
      else statements.push({ kind: 'discover-harness', target: target.value });
    } else if (head.value === 'use-dsl') {
      const dialect = take('word');
      if (dialect === undefined) errors.push(`${at}: use-dsl requires a dialect word`);
      else statements.push({ kind: 'use-dsl', dialect: dialect.value });
    } else if (head.value === 'emit') {
      const artifact = take('word');
      const payload = take('string');
      if (artifact === undefined || payload === undefined) {
        errors.push(`${at}: emit requires an artifact word and a quoted payload`);
      } else {
        statements.push({ kind: 'emit', artifact: artifact.value, payload: payload.value });
      }
    } else if (head.value === 'verify') {
      const artifact = take('word');
      if (artifact === undefined) errors.push(`${at}: verify requires an artifact word`);
      else statements.push({ kind: 'verify', artifact: artifact.value });
    } else {
      errors.push(`${at}: unknown keyword "${head.value}" (canonical form has no synonyms)`);
    }

    if (errors.length === 0 && take('terminator') === undefined) {
      errors.push(`${at}: missing ";" terminator`);
    }
  }

  const emitted = new Set<string>();
  let dialectDeclared = false;
  for (const [position, statement] of statements.entries()) {
    const at = `statement ${position + 1}`;
    if (statement.kind === 'use-dsl') dialectDeclared = true;
    if (statement.kind === 'emit' && !dialectDeclared) {
      errors.push(`${at}: emit before use-dsl (dialect must be declared first)`);
    }
    if (statement.kind === 'emit') emitted.add(statement.artifact);
    if (statement.kind === 'verify' && !emitted.has(statement.artifact)) {
      errors.push(`${at}: verify targets "${statement.artifact}" which was never emitted`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, program: { statements } };
}

export function toLarkGrammar(): string {
  return [
    'start: statement+',
    'statement: discover_harness | use_dsl | emit | verify',
    'discover_harness: "discover-harness" WORD ";"',
    'use_dsl: "use-dsl" WORD ";"',
    'emit: "emit" WORD STRING ";"',
    'verify: "verify" WORD ";"',
    'WORD: /[a-z][a-z0-9-]*/',
    'STRING: /"[^"]*"/',
    '%ignore /[ \\t\\n]+/',
  ].join('\n');
}
