export interface GuidanceSerializedGrammar {
  grammars?: Array<Record<string, unknown>>;
  max_tokens?: number;
}

export class GrammarNode {
  maxTokens?: number;
  serialize(): GuidanceSerializedGrammar | unknown;
}

export class RegexNode extends GrammarNode {}

export interface GuidanceGenOptions {
  stop?: string;
  maxTokens?: number;
  listAppend?: boolean;
}

export function capture(name: string, value: GrammarNode | string): GrammarNode;
export function gen(name: string, pattern?: RegExp | string, options?: GuidanceGenOptions): GrammarNode;
export function grm(strings: TemplateStringsArray, ...values: unknown[]): GrammarNode;
export function join(...values: unknown[]): GrammarNode;
export function select(...values: unknown[]): GrammarNode;
export function str(value: string): GrammarNode;
