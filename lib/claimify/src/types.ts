export type ClaimifyDevice = 'webgpu' | 'wasm';
export type ClaimifyDevicePreference = ClaimifyDevice | 'auto';
export type ClaimifyDtype = 'q4' | 'q4f16' | 'fp16' | 'fp32';
export type ClaimStrictness = 'strict' | 'balanced' | 'recall';
export type DroppedStage = 'selection' | 'disambiguation' | 'decomposition' | 'validation';

export interface ClaimExtractor {
  preload(options?: PreloadOptions): Promise<PreloadResult>;
  isReadyOffline(): Promise<boolean>;
  extract(input: ClaimExtractionInput): Promise<ClaimExtractionResult>;
  dispose(): Promise<void> | void;
}

export type ClaimExtractionInput = {
  question: string;
  answer: string;
  metadata?: {
    headings?: string[];
    sourceName?: string;
    generatedAt?: string;
  };
  options?: {
    contextBefore?: number;
    contextAfter?: number;
    strictness?: ClaimStrictness;
    includeIntermediateStages?: boolean;
    signal?: AbortSignal;
  };
};

export type ClaimExtractionResult = {
  claims: ExtractedClaim[];
  dropped: DroppedSentence[];
  diagnostics: ExtractionDiagnostics;
};

export type ExtractedClaim = {
  id: string;
  claim: string;
  sourceSentence: string;
  sourceSentenceIndex: number;
  inferredContext: string[];
  preservedAttribution: boolean;
  confidence: 'high' | 'medium' | 'low';
  intermediate?: {
    selectedSentence?: string;
    clarifiedSentence?: string;
    selectionReason?: string;
    disambiguationReason?: string;
  };
};

export type DroppedSentence = {
  sentence: string;
  sentenceIndex: number;
  stage: DroppedStage;
  reason: string;
};

export type PreloadOptions = {
  modelId?: string;
  device?: ClaimifyDevicePreference;
  dtype?: ClaimifyDtype;
  progressCallback?: (event: unknown) => void;
};

export type PreloadResult = {
  modelId: string;
  cached: boolean;
  device: ClaimifyDevice;
  dtype: string;
};

export type ExtractionDiagnostics = {
  sentenceCount: number;
  selectedCount: number;
  droppedCount: number;
  droppedByStage: Record<DroppedStage, number>;
  claimCount: number;
  modelId: string | null;
  device: ClaimifyDevice | null;
  dtype: string | null;
  elapsedMs: number;
};

export type SelectionPromptInput = {
  question: string;
  sentence: string;
  excerpt: string;
  strictness: ClaimStrictness;
};

export type DisambiguationPromptInput = SelectionPromptInput & {
  selectedSentence: string;
};

export type DecompositionPromptInput = SelectionPromptInput & {
  clarifiedSentence: string;
};

export type SelectionModelOutput = {
  status: 'selected' | 'no_verifiable_claims';
  reason: string;
  verifiableSentence: string | null;
  removedUnverifiableContent: string[];
};

export type DisambiguationModelOutput = {
  status: 'disambiguated' | 'cannot_be_disambiguated';
  ambiguityType: 'referential' | 'structural' | 'both' | null;
  possibleInterpretations: string[];
  reason: string;
  clarifiedSentence: string | null;
  changes: string[];
};

export type DecompositionModelOutput = {
  claims: Array<{
    claim: string;
    inferredContext: string[];
    preservedAttribution: boolean;
    confidence: 'high' | 'medium' | 'low';
  }>;
};

export type TextGenerationPipeline = (
  prompt: string,
  options: {
    temperature: 0;
    do_sample: false;
    max_new_tokens: number;
  },
) => Promise<unknown>;

export type ClaimifyWorkerRequest =
  | { type: 'preload'; requestId: string; options?: Omit<PreloadOptions, 'progressCallback'> }
  | { type: 'offline-ready'; requestId: string }
  | { type: 'extract'; requestId: string; input: ClaimExtractionInput }
  | { type: 'dispose'; requestId: string };

export type ClaimifyWorkerResponse =
  | { type: 'progress'; requestId: string; event: unknown }
  | { type: 'result'; requestId: string; result: unknown }
  | { type: 'error'; requestId: string; error: { name: string; message: string } };
