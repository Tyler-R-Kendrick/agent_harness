import { describe, expect, it } from 'vitest';
import {
  buildDecompositionPrompt,
  buildDisambiguationPrompt,
  buildSelectionPrompt,
} from '../prompts';

const base = {
  question: 'What did Contoso report about revenue?',
  sentence: 'It reported $12 million in revenue in 2025.',
  excerpt: '[TARGET 0] It reported $12 million in revenue in 2025.',
  strictness: 'strict' as const,
};

describe('prompt builders', () => {
  it('builds a selection prompt with the strict JSON schema and Claimify rules', () => {
    const prompt = buildSelectionPrompt(base);

    expect(prompt).toContain('"status": "selected" | "no_verifiable_claims"');
    expect(prompt).toContain('Question: What did Contoso report about revenue?');
    expect(prompt).toContain('Do not decide whether claims are true.');
    expect(prompt).toContain('Prefer high precision over high recall in strict mode.');
  });

  it('builds a disambiguation prompt with ambiguity-specific schema', () => {
    const prompt = buildDisambiguationPrompt({ ...base, selectedSentence: base.sentence });

    expect(prompt).toContain('"ambiguityType": "referential" | "structural" | "both" | null');
    expect(prompt).toContain('Drop unresolved ambiguity.');
    expect(prompt).toContain('Selected sentence: It reported $12 million in revenue in 2025.');
  });

  it('builds a decomposition prompt preserving attribution and qualifiers', () => {
    const prompt = buildDecompositionPrompt({ ...base, clarifiedSentence: 'Contoso reported $12 million in revenue in 2025.' });

    expect(prompt).toContain('"claims"');
    expect(prompt).toContain('"preservedAttribution": true');
    expect(prompt).toContain('Preserve timeframes, quantities, comparisons, locations, conditions, and exceptions.');
  });
});
