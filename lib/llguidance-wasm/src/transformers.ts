import { TokenMaskApplier } from './mask.js';
import type { CommitResult } from './types.js';

export interface MaskableLlguidanceSession {
  vocabSize(): number;
  computeMask(matcherId: number): Uint32Array;
  commitToken(matcherId: number, tokenId: number): CommitResult;
  commitTokens(matcherId: number, tokenIds: Uint32Array): CommitResult;
  computeFfTokens(matcherId: number): Uint32Array;
  isStopped(matcherId: number): boolean;
}

export class LlguidanceLogitsMasker {
  private readonly applier: TokenMaskApplier;
  private readonly session: MaskableLlguidanceSession;
  private readonly matcherId: number;

  constructor(
    session: MaskableLlguidanceSession,
    matcherId: number,
    vocabSize?: number
  ) {
    this.session = session;
    this.matcherId = matcherId;
    this.applier = new TokenMaskApplier(vocabSize ?? session.vocabSize());
  }

  apply(logits: Float32Array | number[]): void {
    this.applier.apply(logits, this.session.computeMask(this.matcherId));
  }

  commit(tokenId: number): void {
    const result = this.session.commitToken(this.matcherId, tokenId);
    const ffTokens = result.ffTokens?.length ? new Uint32Array(result.ffTokens) : this.session.computeFfTokens(this.matcherId);
    if (ffTokens.length > 0) {
      this.session.commitTokens(this.matcherId, ffTokens);
    }
  }

  stopped(): boolean {
    return this.session.isStopped(this.matcherId);
  }
}
