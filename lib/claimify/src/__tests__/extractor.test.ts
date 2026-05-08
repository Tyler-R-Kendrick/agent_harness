import { describe, expect, it, vi } from 'vitest';
import { BrowserClaimExtractor } from '../extractor';
import { setTransformersImporterForTest } from '../model';

describe('BrowserClaimExtractor', () => {
  it('preloads with injected generator and reports offline readiness', async () => {
    const extractor = new BrowserClaimExtractor({
      generator: vi.fn(),
      preloadResult: {
        modelId: 'fake-model',
        cached: true,
        device: 'wasm',
        dtype: 'q4',
      },
      cacheChecker: async () => true,
    });

    await expect(extractor.isReadyOffline()).resolves.toBe(true);
    await expect(extractor.preload()).resolves.toMatchObject({ modelId: 'fake-model', cached: true });
  });

  it('preloads metadata for an injected generator and disposes state', async () => {
    const extractor = new BrowserClaimExtractor({ generator: vi.fn() });

    await expect(extractor.isReadyOffline()).resolves.toBe(false);
    await expect(extractor.preload({ device: 'webgpu', dtype: 'fp32', modelId: 'custom-model' })).resolves.toEqual({
      modelId: 'custom-model',
      cached: true,
      device: 'webgpu',
      dtype: 'fp32',
    });
    await expect(extractor.isReadyOffline()).resolves.toBe(true);
    extractor.dispose();
    await expect(extractor.isReadyOffline()).resolves.toBe(false);
  });

  it('uses default metadata for injected generator preload', async () => {
    const extractor = new BrowserClaimExtractor({ generator: vi.fn() });

    await expect(extractor.preload()).resolves.toEqual({
      modelId: 'injected-generator',
      cached: true,
      device: 'wasm',
      dtype: 'q4',
    });
  });

  it('lazy-loads a generator when none is injected', async () => {
    const generator = vi.fn(async () => [{ generated_text: JSON.stringify({ status: 'no_verifiable_claims', verifiableSentence: null, reason: 'skip' }) }]);
    setTransformersImporterForTest(async () => ({ pipeline: vi.fn(async () => generator) }));
    const extractor = new BrowserClaimExtractor();

    await expect(extractor.extract({ question: 'Q', answer: 'A sentence.' })).resolves.toMatchObject({
      claims: [],
      diagnostics: { modelId: 'onnx-community/Qwen2.5-0.5B-Instruct' },
    });

    setTransformersImporterForTest();
  });

  it('runs selection, disambiguation, decomposition, validation, and diagnostics', async () => {
    const outputs = [
      { status: 'selected', reason: 'verifiable', verifiableSentence: 'Contoso reported $12 million in revenue in 2025.', removedUnverifiableContent: [] },
      { status: 'disambiguated', ambiguityType: null, possibleInterpretations: [], reason: 'clear', clarifiedSentence: 'Contoso reported $12 million in revenue in 2025.', changes: [] },
      { claims: [{ claim: 'Contoso reported $12 million in revenue in 2025.', inferredContext: [], preservedAttribution: true, confidence: 'high' }] },
      { status: 'no_verifiable_claims', reason: 'opinion', verifiableSentence: null, removedUnverifiableContent: ['Great news.'] },
    ];
    const generator = vi.fn(async () => [{ generated_text: JSON.stringify(outputs.shift()) }]);
    const extractor = new BrowserClaimExtractor({ generator });

    const result = await extractor.extract({
      question: 'What did Contoso report?',
      answer: 'Contoso reported $12 million in revenue in 2025. Great news.',
      metadata: { sourceName: 'Report' },
      options: { includeIntermediateStages: true },
    });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({
      id: 'claim-0-0',
      sourceSentenceIndex: 0,
      preservedAttribution: true,
      confidence: 'high',
      intermediate: {
        selectedSentence: 'Contoso reported $12 million in revenue in 2025.',
        clarifiedSentence: 'Contoso reported $12 million in revenue in 2025.',
      },
    });
    expect(result.dropped).toEqual([
      { sentence: 'Great news.', sentenceIndex: 1, stage: 'selection', reason: 'opinion' },
    ]);
    expect(result.diagnostics).toMatchObject({
      sentenceCount: 2,
      selectedCount: 1,
      claimCount: 1,
      droppedByStage: { selection: 1, disambiguation: 0, decomposition: 0, validation: 0 },
    });
  });

  it('omits intermediate stages unless requested', async () => {
    const outputs = [
      { status: 'selected', reason: 'verifiable', verifiableSentence: 'Contoso reported $12 million in revenue in 2025.', removedUnverifiableContent: [] },
      { status: 'disambiguated', ambiguityType: null, possibleInterpretations: [], reason: 'clear', clarifiedSentence: 'Contoso reported $12 million in revenue in 2025.', changes: [] },
      { claims: [{ claim: 'Contoso reported $12 million in revenue in 2025.', inferredContext: [], preservedAttribution: true, confidence: 'high' }] },
    ];
    const generator = vi.fn(async () => [{ generated_text: JSON.stringify(outputs.shift()) }]);
    const extractor = new BrowserClaimExtractor({ generator });

    const result = await extractor.extract({
      question: 'What did Contoso report?',
      answer: 'Contoso reported $12 million in revenue in 2025.',
      options: { signal: new AbortController().signal },
    });

    expect(result.claims[0]?.intermediate).toBeUndefined();
  });

  it('drops ambiguous, empty decomposition, and invalid claims', async () => {
    const outputs = [
      { status: 'selected', reason: 'verifiable', verifiableSentence: 'It reported growth.', removedUnverifiableContent: [] },
      { status: 'cannot_be_disambiguated', ambiguityType: 'referential', possibleInterpretations: ['Contoso', 'Fabrikam'], reason: 'unclear subject', clarifiedSentence: null, changes: [] },
      { status: 'selected', reason: 'verifiable', verifiableSentence: 'Fabrikam opened a lab.', removedUnverifiableContent: [] },
      { status: 'disambiguated', ambiguityType: null, possibleInterpretations: [], reason: 'clear', clarifiedSentence: 'Fabrikam opened a lab.', changes: [] },
      { claims: [] },
      { status: 'selected', reason: 'verifiable', verifiableSentence: 'It grew.', removedUnverifiableContent: [] },
      { status: 'disambiguated', ambiguityType: null, possibleInterpretations: [], reason: 'clear', clarifiedSentence: 'It grew.', changes: [] },
      { claims: [{ claim: 'It grew.', inferredContext: [], preservedAttribution: false, confidence: 'low' }] },
    ];
    const generator = vi.fn(async () => [{ generated_text: JSON.stringify(outputs.shift()) }]);
    const extractor = new BrowserClaimExtractor({ generator });

    const result = await extractor.extract({
      question: 'What happened?',
      answer: 'It reported growth. Fabrikam opened a lab. It grew.',
    });

    expect(result.claims).toEqual([]);
    expect(result.dropped.map((item) => item.stage)).toEqual([
      'disambiguation',
      'decomposition',
      'validation',
    ]);
  });

  it('supports cancellation before orchestration starts', async () => {
    const signal = AbortSignal.abort('stop');
    const extractor = new BrowserClaimExtractor({ generator: vi.fn() });

    await expect(
      extractor.extract({ question: 'Q', answer: 'A sentence.', options: { signal } }),
    ).rejects.toMatchObject({ name: 'ClaimifyAbortError' });
  });

  it('uses a default cancellation message when no reason is present', async () => {
    const signal = { aborted: true, reason: undefined } as AbortSignal;
    const extractor = new BrowserClaimExtractor({ generator: vi.fn() });

    await expect(
      extractor.extract({ question: 'Q', answer: 'A sentence.', options: { signal } }),
    ).rejects.toMatchObject({ name: 'ClaimifyAbortError', message: 'Extraction aborted' });
  });

  it('supports cancellation between model stages', async () => {
    const controller = new AbortController();
    const generator = vi.fn(async () => {
      controller.abort('mid-flight');
      return [{ generated_text: JSON.stringify({ status: 'no_verifiable_claims', verifiableSentence: null, reason: 'skip' }) }];
    });
    const extractor = new BrowserClaimExtractor({ generator });

    await expect(
      extractor.extract({ question: 'Q', answer: 'First sentence. Second sentence.', options: { signal: controller.signal } }),
    ).rejects.toMatchObject({ name: 'ClaimifyAbortError', message: 'mid-flight' });
  });
});
