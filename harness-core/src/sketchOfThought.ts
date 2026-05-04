import {
  gen,
  grm,
  join,
  select,
  str,
  type GrammarNode,
} from 'guidance-ts/src/gen';
import { constrainToToon, type ToonConstrainedDecoding } from './constrainedDecoding.js';
import {
  buildSketchOfThoughtExpertAgentPrompt,
  buildSketchOfThoughtSystemPrompt,
  resolveSketchOfThoughtParadigm,
  type SketchOfThoughtParadigm,
  type SketchOfThoughtExpertAgentOptions,
} from './expertAgents.js';
import { withMaxTokens } from './guidanceGrammarUtils.js';

export {
  buildSketchOfThoughtExpertAgentPrompt,
  buildSketchOfThoughtSystemPrompt,
  resolveSketchOfThoughtParadigm,
  type SketchOfThoughtExpertAgentOptions,
  type SketchOfThoughtParadigm,
};

export function buildSketchOfThoughtExpertLexiconGrammar({
  expertLexiconSummary,
  maxTokens = 96,
}: SketchOfThoughtExpertAgentOptions): GrammarNode {
  return buildSketchOfThoughtGrammar({ paradigm: 'expert_lexicons', topic: '', expertLexiconSummary, maxTokens });
}

export function buildSketchOfThoughtGrammar(
  options: SketchOfThoughtExpertAgentOptions,
): GrammarNode {
  const maxTokens = options.maxTokens ?? 96;
  const paradigm = options.paradigm && options.paradigm !== 'auto'
    ? options.paradigm
    : resolveSketchOfThoughtParadigm([
      options.topic,
      options.topicDescription,
      options.expertLexiconSummary,
    ].filter(Boolean).join(' '));

  switch (paradigm) {
    case 'chunked_symbolism':
      return buildChunkedSymbolismGrammar(maxTokens);
    case 'conceptual_chaining':
      return buildConceptualChainingGrammar(maxTokens);
    case 'expert_lexicons':
      return buildExpertLexiconGrammar(options.expertLexiconSummary, maxTokens);
    case 'cot':
      return buildChainOfThoughtGrammar(maxTokens);
  }
}

function buildExpertLexiconGrammar(expertLexiconSummary: string, maxTokens: number): GrammarNode {
  const lexicon = extractLexiconLiterals(expertLexiconSummary);
  const lexeme = select(
    ...lexicon.map((value) => str(value)),
    gen('sketch', /[^\r\n\\{}]{1,96}/, { stop: '\n' }),
  );

  return withMaxTokens(join(
    grm`${join(
    lexeme,
    gen('sketch.tail', /[^\r\n]{0,240}/, { stop: '\n' }),
  )}`,
    '\n',
    str('\\boxed{'),
    gen('answer', /[^}\r\n]{1,120}/, { stop: '}' }),
    str('}'),
  ), maxTokens);
}

function buildChunkedSymbolismGrammar(maxTokens: number): GrammarNode {
  return withMaxTokens(join(
    'A',
    '=',
    gen('value', /[^\r\n]{1,80}/, { stop: '\n' }),
    '\n',
    gen('equation', /[A-Za-z][A-Za-z0-9_]*\s*[-+*/=<>].{1,100}/, { stop: '\n' }),
    '\n',
    str('\\boxed{'),
    gen('answer', /[^}\r\n]{1,80}/, { stop: '}' }),
    str('}'),
  ), maxTokens);
}

function buildConceptualChainingGrammar(maxTokens: number): GrammarNode {
  return withMaxTokens(join(
    gen('concept.head', /[^\r\n→]{1,80}/, { stop: '→' }),
    '→',
    gen('concept.chain', /[^\r\n]{1,180}/, { stop: '\n' }),
    '\n',
    str('\\boxed{'),
    gen('answer', /[^}\r\n]{1,80}/, { stop: '}' }),
    str('}'),
  ), maxTokens);
}

function buildChainOfThoughtGrammar(maxTokens: number): GrammarNode {
  return withMaxTokens(join(
    '1. ',
    gen('step.one', /[^\r\n]{1,160}/, { stop: '\n' }),
    '\n',
    '2. ',
    gen('step.two', /[^\r\n]{0,160}/, { stop: '\n' }),
    '\n',
    str('\\boxed{'),
    gen('answer', /[^}\r\n]{1,80}/, { stop: '}' }),
    str('}'),
  ), maxTokens);
}

export function buildSketchOfThoughtConstrainedDecoding(
  options: SketchOfThoughtExpertAgentOptions,
): ToonConstrainedDecoding<string> {
  const maxTokens = options.maxTokens ?? 96;
  return constrainToToon<string>({
    maxTokens,
    grammar: buildSketchOfThoughtGrammar({ ...options, maxTokens }),
    decode: (text) => text,
  });
}

function extractLexiconLiterals(summary: string): string[] {
  const matches = Array.from(
    summary.matchAll(/[A-Z][A-Z0-9+-]{1,}|[A-Za-z]+-[A-Za-z0-9-]+|[∑∴∝Δ→←↔≤≥≠≈]/g),
    (match) => match[0],
  );
  return [...new Set(matches)].slice(0, 12);
}
