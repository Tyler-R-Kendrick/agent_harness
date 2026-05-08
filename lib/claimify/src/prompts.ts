import type { DecompositionPromptInput, DisambiguationPromptInput, SelectionPromptInput } from './types';

const sharedRules = [
  'Do not decide whether claims are true.',
  'Only extract claims that are checkable by a fact-checker.',
  'Preserve attribution.',
  'Preserve timeframes, quantities, comparisons, locations, conditions, and exceptions.',
  'Drop unresolved ambiguity.',
  'Prefer high precision over high recall in strict mode.',
];

export function buildSelectionPrompt(input: SelectionPromptInput): string {
  return [
    'You are running Claimify-style Stage 1: Selection.',
    ...sharedRules,
    `Strictness: ${input.strictness}`,
    `Question: ${input.question}`,
    `Target sentence: ${input.sentence}`,
    `Context excerpt:\n${input.excerpt}`,
    'Return strict JSON only with this schema:',
    '{',
    '  "status": "selected" | "no_verifiable_claims",',
    '  "reason": "string",',
    '  "verifiableSentence": "string or null",',
    '  "removedUnverifiableContent": ["string"]',
    '}',
  ].join('\n');
}

export function buildDisambiguationPrompt(input: DisambiguationPromptInput): string {
  return [
    'You are running Claimify-style Stage 2: Disambiguation.',
    ...sharedRules,
    `Strictness: ${input.strictness}`,
    `Question: ${input.question}`,
    `Selected sentence: ${input.selectedSentence}`,
    `Context excerpt:\n${input.excerpt}`,
    'Resolve ambiguity only when one interpretation is clearly more likely from the question and excerpt.',
    'Return strict JSON only with this schema:',
    '{',
    '  "status": "disambiguated" | "cannot_be_disambiguated",',
    '  "ambiguityType": "referential" | "structural" | "both" | null,',
    '  "possibleInterpretations": ["string"],',
    '  "reason": "string",',
    '  "clarifiedSentence": "string or null",',
    '  "changes": ["string"]',
    '}',
  ].join('\n');
}

export function buildDecompositionPrompt(input: DecompositionPromptInput): string {
  return [
    'You are running Claimify-style Stage 3: Decomposition.',
    ...sharedRules,
    `Strictness: ${input.strictness}`,
    `Question: ${input.question}`,
    `Clarified sentence: ${input.clarifiedSentence}`,
    `Context excerpt:\n${input.excerpt}`,
    'Prefer fewer high-quality claims over many weak or over-atomic fragments.',
    'Use bracketed text only for essential context inferred from the question or excerpt.',
    'Return strict JSON only with this schema:',
    '{',
    '  "claims": [',
    '    {',
    '      "claim": "string",',
    '      "inferredContext": ["string"],',
    '      "preservedAttribution": true,',
    '      "confidence": "high" | "medium" | "low"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
}
