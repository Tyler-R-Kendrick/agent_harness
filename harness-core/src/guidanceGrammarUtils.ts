import type { GrammarNode } from 'guidance-ts/src/gen';

export function withMaxTokens<TGrammar extends GrammarNode>(grammar: TGrammar, maxTokens: number): TGrammar {
  grammar.maxTokens = maxTokens;
  return grammar;
}

export function textFragmentPattern(maxLength: number): RegExp {
  return new RegExp(`[^"\\r\\n]{0,${maxLength}}`);
}
