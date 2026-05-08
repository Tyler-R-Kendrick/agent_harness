import type { GrammarInput } from './types.js';

export function grammarCandidates(input: GrammarInput): string[] {
  const candidates = uniqueCandidates(rawCandidates(input));
  if (candidates.length === 0) {
    throw new Error(`No finite candidates could be derived from ${input.kind} grammar input.`);
  }
  return candidates;
}

function rawCandidates(input: GrammarInput): string[] {
  if (input.kind === 'json_schema') {
    return jsonSchemaCandidates(input.schema);
  }

  if (input.kind === 'lark') {
    return quotedLiterals(input.grammar);
  }

  if (input.kind === 'regex') {
    return regexCandidates(input.regex);
  }

  return serializedCandidates(input.grammar);
}

function jsonSchemaCandidates(schema: unknown): string[] {
  if (!isRecord(schema)) {
    return [];
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.filter((value): value is string => typeof value === 'string');
  }

  if (typeof schema.const === 'string') {
    return [schema.const];
  }

  if (schema.type === 'object' && isRecord(schema.properties)) {
    const entries = Object.entries(schema.properties);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      const values = jsonSchemaCandidates(value);
      return values.map((candidate) => JSON.stringify({ [key]: candidate }));
    }
  }

  return [];
}

function serializedCandidates(grammar: unknown): string[] {
  if (!isRecord(grammar)) {
    return [];
  }

  const explicit = collectStringArray(grammar.string_literals)
    .concat(collectStringArray(grammar.candidates));
  if (explicit.length > 0) {
    return explicit;
  }

  if (Array.isArray(grammar.grammars)) {
    return grammar.grammars.flatMap((entry) => serializedCandidates(entry));
  }

  if (typeof grammar.lark_grammar === 'string') {
    return quotedLiterals(grammar.lark_grammar);
  }

  if (isRecord(grammar.json_schema)) {
    return jsonSchemaCandidates(grammar.json_schema);
  }

  return recursivelyCollectStringLiterals(grammar);
}

function regexCandidates(regex: string): string[] {
  const trimmed = regex.replace(/^\^/, '').replace(/\$$/, '').trim();
  const match = /^\(([^()[\]]+)\)$/.exec(trimmed) ?? /^([^()[\]]+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported regex grammar. Only finite literal alternatives are supported: ${regex}`);
  }

  return match[1]
    .split('|')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
}

function quotedLiterals(source: string): string[] {
  const values: string[] = [];
  const pattern = /"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    values.push(JSON.parse(`"${match[1]}"`) as string);
  }

  return values;
}

function collectStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function recursivelyCollectStringLiterals(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => recursivelyCollectStringLiterals(entry));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => recursivelyCollectStringLiterals(entry));
  }

  return [];
}

function uniqueCandidates(candidates: string[]): string[] {
  return [...new Set(candidates.filter((candidate) => candidate.length > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
