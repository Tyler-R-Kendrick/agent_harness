import { ClaimifyAbortError } from './errors';
import { loadTextGenerationPipeline, generateJson } from './model';
import { buildDecompositionPrompt, buildDisambiguationPrompt, buildSelectionPrompt } from './prompts';
import { buildExcerpt, splitSentences } from './sentence';
import type {
  ClaimExtractionInput,
  ClaimExtractionResult,
  ClaimExtractor,
  DecompositionModelOutput,
  DisambiguationModelOutput,
  DroppedSentence,
  DroppedStage,
  ExtractedClaim,
  PreloadOptions,
  PreloadResult,
  SelectionModelOutput,
  TextGenerationPipeline,
} from './types';
import { deduplicateClaims, normalizeClaim, validateClaim } from './validation';

export type BrowserClaimExtractorOptions = {
  generator?: TextGenerationPipeline;
  preloadResult?: PreloadResult;
  cacheChecker?: () => Promise<boolean>;
};

const EMPTY_DROPS: Record<DroppedStage, number> = {
  selection: 0,
  disambiguation: 0,
  decomposition: 0,
  validation: 0,
};

export class BrowserClaimExtractor implements ClaimExtractor {
  private generator: TextGenerationPipeline | null;
  private preloadState: PreloadResult | null;
  private readonly cacheChecker?: () => Promise<boolean>;

  constructor(options: BrowserClaimExtractorOptions = {}) {
    this.generator = options.generator ?? null;
    this.preloadState = options.preloadResult ?? null;
    this.cacheChecker = options.cacheChecker;
  }

  async preload(options: PreloadOptions = {}): Promise<PreloadResult> {
    if (this.generator && this.preloadState) {
      return this.preloadState;
    }
    if (!this.generator) {
      const loaded = await loadTextGenerationPipeline(options);
      this.generator = loaded.generator;
      this.preloadState = loaded.preload;
      return loaded.preload;
    }
    this.preloadState = {
      modelId: options.modelId ?? 'injected-generator',
      cached: true,
      device: options.device === 'webgpu' ? 'webgpu' : 'wasm',
      dtype: options.dtype ?? 'q4',
    };
    return this.preloadState;
  }

  async isReadyOffline(): Promise<boolean> {
    if (this.cacheChecker) {
      return this.cacheChecker();
    }
    return Boolean(this.preloadState?.cached);
  }

  async extract(input: ClaimExtractionInput): Promise<ClaimExtractionResult> {
    throwIfAborted(input.options?.signal);
    const started = performance.now();
    const generator = await this.getGenerator();
    const sentences = splitSentences(input.answer);
    const dropped: DroppedSentence[] = [];
    const claims: ExtractedClaim[] = [];
    let selectedCount = 0;
    const contextBefore = input.options?.contextBefore ?? 1;
    const contextAfter = input.options?.contextAfter ?? 1;
    const strictness = input.options?.strictness ?? 'strict';

    for (const [sentenceIndex, sentence] of sentences.entries()) {
      throwIfAborted(input.options?.signal);
      const excerpt = buildExcerpt(sentences, sentenceIndex, contextBefore, contextAfter, input.metadata);
      const selection = await generateJson<SelectionModelOutput>(
        generator,
        buildSelectionPrompt({ question: input.question, sentence, excerpt, strictness }),
      );
      if (selection.status !== 'selected' || !selection.verifiableSentence) {
        dropped.push(drop(sentence, sentenceIndex, 'selection', selection.reason));
        continue;
      }
      selectedCount += 1;

      const disambiguation = await generateJson<DisambiguationModelOutput>(
        generator,
        buildDisambiguationPrompt({
          question: input.question,
          sentence,
          excerpt,
          strictness,
          selectedSentence: selection.verifiableSentence,
        }),
      );
      if (disambiguation.status !== 'disambiguated' || !disambiguation.clarifiedSentence) {
        dropped.push(drop(sentence, sentenceIndex, 'disambiguation', disambiguation.reason));
        continue;
      }

      const decomposition = await generateJson<DecompositionModelOutput>(
        generator,
        buildDecompositionPrompt({
          question: input.question,
          sentence,
          excerpt,
          strictness,
          clarifiedSentence: disambiguation.clarifiedSentence,
        }),
      );
      if (decomposition.claims.length === 0) {
        dropped.push(drop(sentence, sentenceIndex, 'decomposition', 'No standalone claims returned'));
        continue;
      }

      const beforeValidationCount = claims.length;
      for (const [claimIndex, candidate] of decomposition.claims.entries()) {
        const validation = validateClaim(candidate.claim, { strictness });
        if (!validation.acceptable) {
          dropped.push(drop(sentence, sentenceIndex, 'validation', validation.reason as string));
          continue;
        }
        claims.push({
          id: `claim-${sentenceIndex}-${claimIndex}`,
          claim: normalizeClaim(validation.claim),
          sourceSentence: sentence,
          sourceSentenceIndex: sentenceIndex,
          inferredContext: candidate.inferredContext,
          preservedAttribution: candidate.preservedAttribution,
          confidence: candidate.confidence,
          intermediate: input.options?.includeIntermediateStages
            ? {
                selectedSentence: selection.verifiableSentence,
                clarifiedSentence: disambiguation.clarifiedSentence,
                selectionReason: selection.reason,
                disambiguationReason: disambiguation.reason,
              }
            : undefined,
        });
      }
    }

    const dedupedClaims = deduplicateClaims(claims);
    const droppedByStage = dropped.reduce<Record<DroppedStage, number>>(
      (counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + 1 }),
      { ...EMPTY_DROPS },
    );
    return {
      claims: dedupedClaims,
      dropped,
      diagnostics: {
        sentenceCount: sentences.length,
        selectedCount,
        droppedCount: dropped.length,
        droppedByStage,
        claimCount: dedupedClaims.length,
        modelId: this.preloadState?.modelId ?? null,
        device: this.preloadState?.device ?? null,
        dtype: this.preloadState?.dtype ?? null,
        elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      },
    };
  }

  dispose(): void {
    this.generator = null;
    this.preloadState = null;
  }

  private async getGenerator(): Promise<TextGenerationPipeline> {
    if (!this.generator) {
      await this.preload();
    }
    return this.generator as TextGenerationPipeline;
  }
}

function drop(sentence: string, sentenceIndex: number, stage: DroppedStage, reason: string): DroppedSentence {
  return { sentence, sentenceIndex, stage, reason };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal || !signal.aborted) {
    return;
  }
  throw new ClaimifyAbortError(String(signal.reason ?? 'Extraction aborted'));
}
