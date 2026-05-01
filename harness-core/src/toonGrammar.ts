import {
  DEFAULT_DELIMITER,
  DELIMITERS,
  decode,
  encode,
  type JsonValue,
} from '@toon-format/toon';
import {
  CONSTRAINED_DECODING_DECODE_HOOK_POINT,
  CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
  type ConstrainedOutputDecodeHookPayload,
  type ConstrainedOutputGrammarHookPayload,
} from './constrainedDecoding.js';
import type { HarnessPlugin } from './plugins.js';

export const TOON_GRAMMAR_SOURCE_PACKAGE = '@toon-format/toon';
export const TOON_GRAMMAR_PLUGIN_ID = 'toon-grammar';
export const TOON_GRAMMAR_HOOK_ID = 'toon-grammar:grammar';
export const TOON_DECODE_HOOK_ID = 'toon-grammar:decode';

export const TOON_LARK_GRAMMAR = String.raw`%llguidance {}
start: document?

?document: object
  | array
  | primitive

object: object_field (_NL object_field)* _NL?
object_field: indent? key ":" field_value?
field_value: WS? (primitive | inline_array | array | object)

?array: tabular_array
  | list_array
tabular_array: tabular_header (_NL tabular_row)* _NL?
list_array: list_header (_NL list_item)* _NL?
array_header: tabular_header | list_header
tabular_header: key? "[" INT "]" field_list ":"
list_header: key? "[" INT "]" ":"
field_list: "{" key (delimiter key)* "}"
tabular_row: indent? scalar (delimiter scalar)*
list_item: indent? "- " (primitive | inline_array | object | array)?

inline_array: "[" scalar_list? "]"
scalar_list: scalar (delimiter scalar)*

?primitive: null
  | boolean
  | number
  | quoted_string
  | bare_string
?scalar: primitive

key: quoted_string | BARE_KEY
quoted_string: ESCAPED_STRING
bare_string: BARE_VALUE
number: SIGNED_NUMBER
boolean: "true" | "false"
null: "null"
delimiter: "," | "\t" | "|"
indent: /[ \t]+/

BARE_KEY: /[A-Za-z_][A-Za-z0-9_.-]*/
BARE_VALUE: /[^,\t|\r\n\[\]\{\}:][^,\t|\r\n]*/
ESCAPED_STRING: /"([^"\\]|\\.)*"/
SIGNED_NUMBER: /-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/
INT: /0|[1-9][0-9]*/
WS: /[ \t]+/
_NL: /\r?\n/`;

export interface ToonGrammarBuild {
  sourcePackage: typeof TOON_GRAMMAR_SOURCE_PACKAGE;
  defaultDelimiter: string;
  delimiters: string[];
  larkGrammar: string;
  llGuidanceGrammar: {
    grammars: Array<{ name: 'toon'; lark_grammar: string }>;
    max_tokens?: number;
  };
  samples: Array<{
    text: string;
    decoded: JsonValue;
  }>;
}

const TOON_SAMPLE_VALUES = [
  { status: 'ok', count: 2 },
  { users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }] },
  ['red', 'green', 'blue'],
] satisfies unknown[];

export function buildToonGrammar(maxTokens?: number): ToonGrammarBuild {
  const larkGrammar = buildToonLarkGrammar();
  return {
    sourcePackage: TOON_GRAMMAR_SOURCE_PACKAGE,
    defaultDelimiter: DEFAULT_DELIMITER,
    delimiters: Object.values(DELIMITERS),
    larkGrammar,
    llGuidanceGrammar: buildToonLlGuidanceGrammar(maxTokens),
    samples: TOON_SAMPLE_VALUES.map((value) => {
      const text = encode(value);
      return { text, decoded: decode(text) };
    }),
  };
}

export function buildToonLarkGrammar(): string {
  return TOON_LARK_GRAMMAR;
}

export function buildToonLlGuidanceGrammar(maxTokens?: number): ToonGrammarBuild['llGuidanceGrammar'] {
  const grammar: ToonGrammarBuild['llGuidanceGrammar'] = {
    grammars: [{ name: 'toon', lark_grammar: buildToonLarkGrammar() }],
  };
  if (maxTokens === undefined) {
    return grammar;
  }
  return { ...grammar, max_tokens: maxTokens };
}

export function decodeToonDocument(text: string): JsonValue {
  return decode(text);
}

export function createToonGrammarPlugin(): HarnessPlugin {
  return {
    id: TOON_GRAMMAR_PLUGIN_ID,
    register({ hooks }) {
      hooks.registerPipe<ConstrainedOutputGrammarHookPayload>({
        id: TOON_GRAMMAR_HOOK_ID,
        point: CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
        kind: 'deterministic',
        run: ({ payload }) => {
          if (payload.decoding.kind !== 'toon') {
            return undefined;
          }
          return {
            payload: {
              ...payload,
              grammar: buildToonLlGuidanceGrammar(payload.decoding.maxTokens),
            },
            stop: true,
            output: { sourcePackage: TOON_GRAMMAR_SOURCE_PACKAGE },
          };
        },
      });
      hooks.registerPipe<ConstrainedOutputDecodeHookPayload>({
        id: TOON_DECODE_HOOK_ID,
        point: CONSTRAINED_DECODING_DECODE_HOOK_POINT,
        kind: 'deterministic',
        run: ({ payload }) => {
          if (payload.decoding.kind !== 'toon') {
            return undefined;
          }
          return {
            payload: {
              ...payload,
              decoded: decodeToonDocument(payload.text),
            },
            stop: true,
            output: { sourcePackage: TOON_GRAMMAR_SOURCE_PACKAGE },
          };
        },
      });
    },
  };
}
