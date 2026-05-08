export type GrammarInput =
  | { kind: 'serialized'; grammar: unknown }
  | { kind: 'json_schema'; schema: unknown }
  | { kind: 'lark'; grammar: string }
  | { kind: 'regex'; regex: string };

export interface LlgSessionOptions {
  eosTokenIds?: number[];
  bosTokenId?: number;
  unkTokenId?: number;
}

export interface CommitResult {
  stopped: boolean;
  stopReason?: string | null;
  ffTokens?: number[];
  temperature?: number;
}

export interface WorkerInitResult {
  vocabSize: number;
}

export interface WorkerCreateMatcherResult {
  matcherId: number;
}

export interface WorkerMaskResult {
  tokenIds: number[];
}

export type LlguidanceWorkerRequest =
  | { id: number; op: 'init'; tokenizerJson: string; options?: LlgSessionOptions }
  | { id: number; op: 'createMatcher'; input: GrammarInput }
  | { id: number; op: 'computeMask'; matcherId: number }
  | { id: number; op: 'commitToken'; matcherId: number; tokenId: number }
  | { id: number; op: 'freeMatcher'; matcherId: number };

export type LlguidanceWorkerResponse<T = unknown> =
  | { id: number; ok: true; result: T }
  | { id: number; ok: false; error: string };
