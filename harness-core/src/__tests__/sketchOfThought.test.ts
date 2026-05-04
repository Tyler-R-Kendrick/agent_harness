import { describe, expect, it } from 'vitest';
import {
  buildSketchOfThoughtConstrainedDecoding,
  buildSketchOfThoughtExpertAgentPrompt,
  buildSketchOfThoughtExpertLexiconGrammar,
  buildSketchOfThoughtGrammar,
  buildSketchOfThoughtSystemPrompt,
  resolveSketchOfThoughtParadigm,
} from '../sketchOfThought.js';
import { toGuidanceTsGrammar } from '../constrainedDecoding.js';

function serializedNodes(grammar: { serialize: () => unknown }) {
  return (grammar.serialize() as { grammars: Array<{ nodes: unknown[] }> }).grammars[0].nodes;
}

describe('sketch-of-thought expert agents', () => {
  it('supports the SoT paradigms from the reference implementation plus the CoT baseline', () => {
    const chunked = buildSketchOfThoughtSystemPrompt({
      paradigm: 'chunked_symbolism',
      topic: 'unit conversion',
      expertLexiconSummary: 'Use variables, equations, units, and boxed answer.',
    });
    const conceptual = buildSketchOfThoughtSystemPrompt({
      paradigm: 'conceptual_chaining',
      topic: 'multi-hop recall',
      expertLexiconSummary: 'Use key concepts and arrows.',
    });
    const expert = buildSketchOfThoughtSystemPrompt({
      paradigm: 'expert_lexicons',
      topic: 'compiler diagnostics',
      topicDescription: 'Use terse domain notation.',
      expertLexiconSummary: 'Use AST, CFG, TS error code, span, and fix shorthand.',
    });
    const cot = buildSketchOfThoughtSystemPrompt({
      paradigm: 'cot',
      topic: 'audit trail',
      expertLexiconSummary: 'Use numbered steps and final verification.',
    });

    expect(chunked).toContain('Chunked Symbolism');
    expect(chunked).toContain('variables');
    expect(chunked).toContain('equations');
    expect(conceptual).toContain('Conceptual Chaining');
    expect(conceptual).toContain('→');
    expect(expert).toContain('Expert Lexicons');
    expect(expert).toContain('AST, CFG');
    expect(cot).toContain('Chain-of-Thought Baseline');
    expect(cot).toContain('numbered steps');
  });

  it('selects a SoT paradigm using the reference implementation labels as output values', () => {
    expect(resolveSketchOfThoughtParadigm('Alice has 5 apples and gives away 3.')).toBe('chunked_symbolism');
    expect(resolveSketchOfThoughtParadigm('How are photosynthesis and plant growth connected?')).toBe('conceptual_chaining');
    expect(resolveSketchOfThoughtParadigm('Diagnose TS2345 in an AST transform pipeline.')).toBe('expert_lexicons');
    expect(resolveSketchOfThoughtParadigm('Explain every assumption step by step for audit.')).toBe('cot');
  });

  it('honors auto and omitted paradigm selection for prompts and grammars', () => {
    const prompt = buildSketchOfThoughtSystemPrompt({
      paradigm: 'auto',
      topic: 'Calculate 2 + 2.',
      expertLexiconSummary: '',
    });
    const grammar = buildSketchOfThoughtGrammar({
      topic: 'How are memory and retrieval connected?',
      expertLexiconSummary: 'plain lowercase hints',
    });

    expect(prompt).toContain('Chunked Symbolism');
    expect(serializedNodes(grammar)).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: '→' }) }),
    ]));
  });

  it('creates dedicated grammars for each SoT output structure', () => {
    expect(serializedNodes(buildSketchOfThoughtGrammar({
      paradigm: 'chunked_symbolism',
      topic: 'unit conversion',
      expertLexiconSummary: 'Use m, cm, conversion factor.',
    }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: 'A' }) }),
      expect.objectContaining({ String: expect.objectContaining({ literal: '=' }) }),
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));

    expect(serializedNodes(buildSketchOfThoughtGrammar({
      paradigm: 'conceptual_chaining',
      topic: 'cause effect',
      expertLexiconSummary: 'Use premise, bridge, implication.',
    }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: '→' }) }),
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));

    expect(serializedNodes(buildSketchOfThoughtGrammar({
      paradigm: 'cot',
      topic: 'audit',
      expertLexiconSummary: 'Use numbered steps.',
    }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: '1. ' }) }),
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));
  });

  it('builds an on-demand Expert Lexicons prompt from caller supplied topic context', () => {
    const prompt = buildSketchOfThoughtExpertAgentPrompt({
      topic: 'sparse autoencoder mapping',
      topicDescription: 'Map documented SAE releases to compatible model IDs.',
      expertLexiconSummary: 'Use SAE, residual stream, hook point, top-k, width, and model family shorthand.',
    });

    expect(prompt).toContain('## Sketch-of-Thought Expert Agent');
    expect(prompt).toContain('Expert Lexicons');
    expect(prompt).toContain('sparse autoencoder mapping');
    expect(prompt).toContain('Map documented SAE releases to compatible model IDs.');
    expect(prompt).toContain('Use SAE, residual stream, hook point, top-k, width, and model family shorthand.');
    expect(prompt).toContain('No full-sentence chain-of-thought');
    expect(prompt).toContain('\\boxed{');
  });

  it('omits optional topic detail and still creates a default bounded grammar without lexicon terms', () => {
    const prompt = buildSketchOfThoughtExpertAgentPrompt({
      topic: 'general debugging',
      expertLexiconSummary: 'short precise notes',
    });
    const decoding = buildSketchOfThoughtConstrainedDecoding({
      topic: 'general debugging',
      expertLexiconSummary: 'short precise notes',
    });

    expect(prompt).not.toContain('Topic detail:');
    expect(decoding.maxTokens).toBe(96);
    expect(decoding.decode?.('AST -> span\n\\boxed{fix}')).toBe('AST -> span\n\\boxed{fix}');
    expect(serializedNodes(toGuidanceTsGrammar(decoding))).toEqual(expect.arrayContaining([
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));
  });

  it('creates a real guidance-ts GrammarNode for the caller supplied lexicon summary', () => {
    const grammar = buildSketchOfThoughtExpertLexiconGrammar({
      topic: 'cardiology triage',
      expertLexiconSummary: 'Use STEMI, MONA, ASA allergy, contraindication, risk arrows.',
      maxTokens: 80,
    });

    expect(grammar).toEqual(expect.objectContaining({ serialize: expect.any(Function), maxTokens: 80 }));
    expect(serializedNodes(grammar)).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: 'STEMI' }) }),
      expect.objectContaining({ String: expect.objectContaining({ literal: 'MONA' }) }),
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));
  });

  it('turns the dynamic expert lexicon grammar into constrained decoding for the agent loop', () => {
    const decoding = buildSketchOfThoughtConstrainedDecoding({
      topic: 'compiler diagnostics',
      expertLexiconSummary: 'Use AST, CFG, TS error code, source span, fix hint.',
      maxTokens: 48,
    });

    expect(decoding).toEqual(expect.objectContaining({ kind: 'toon', maxTokens: 48 }));
    expect(toGuidanceTsGrammar(decoding).serialize()).toEqual(
      buildSketchOfThoughtExpertLexiconGrammar({
        topic: 'compiler diagnostics',
        expertLexiconSummary: 'Use AST, CFG, TS error code, source span, fix hint.',
        maxTokens: 48,
      }).serialize(),
    );
  });
});
