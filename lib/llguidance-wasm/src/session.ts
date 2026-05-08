import { grammarCandidates } from './grammar.js';
import { loadTokenizer, type LoadedTokenizer } from './tokenizer.js';
import type { CommitResult, GrammarInput, LlgSessionOptions } from './types.js';

interface MatcherState {
  candidates: string[];
  prefix: string;
  stopped: boolean;
  stopReason: string | null;
  pendingFfTokens: number[];
}

let initialized = false;

export async function initLlguidanceWasm(_moduleOrPath?: WebAssembly.Module | string | URL): Promise<void> {
  initialized = true;
}

export class LlguidanceSession {
  private readonly tokenizer: LoadedTokenizer;
  private readonly matchers = new Map<number, MatcherState>();
  private nextMatcherId = 1;

  constructor(tokenizerJson: string, options: LlgSessionOptions = {}) {
    if (!initialized) {
      throw new Error('Call initLlguidanceWasm() before constructing LlguidanceSession.');
    }
    this.tokenizer = loadTokenizer(tokenizerJson, options);
  }

  vocabSize(): number {
    return this.tokenizer.vocabSize;
  }

  tokenText(tokenId: number): string | undefined {
    return this.tokenizer.idToText.get(tokenId);
  }

  createMatcher(input: GrammarInput): number {
    const id = this.nextMatcherId++;
    this.matchers.set(id, {
      candidates: grammarCandidates(input),
      prefix: '',
      stopped: false,
      stopReason: null,
      pendingFfTokens: []
    });
    return id;
  }

  computeMask(matcherId: number): Uint32Array {
    const matcher = this.matcher(matcherId);
    if (matcher.stopped) {
      return new Uint32Array();
    }
    return new Uint32Array(this.allowedTokenIds(matcher));
  }

  commitToken(matcherId: number, tokenId: number): CommitResult {
    const matcher = this.matcher(matcherId);
    this.consumeToken(matcher, tokenId);
    return this.commitResult(matcher);
  }

  commitTokens(matcherId: number, tokenIds: Uint32Array): CommitResult {
    const matcher = this.matcher(matcherId);
    for (const tokenId of tokenIds) {
      this.consumeToken(matcher, tokenId);
      if (matcher.stopped) {
        break;
      }
    }
    return this.commitResult(matcher);
  }

  computeFfTokens(matcherId: number): Uint32Array {
    return new Uint32Array(this.matcher(matcherId).pendingFfTokens);
  }

  isStopped(matcherId: number): boolean {
    return this.matcher(matcherId).stopped;
  }

  stopReason(matcherId: number): string | null {
    return this.matcher(matcherId).stopReason;
  }

  resetMatcher(matcherId: number): void {
    const matcher = this.matcher(matcherId);
    matcher.prefix = '';
    matcher.stopped = false;
    matcher.stopReason = null;
    matcher.pendingFfTokens = [];
  }

  freeMatcher(matcherId: number): void {
    this.matchers.delete(matcherId);
  }

  private consumeToken(matcher: MatcherState, tokenId: number): void {
    if (matcher.stopped) {
      return;
    }

    const allowed = this.allowedTokenIds(matcher);
    if (!allowed.includes(tokenId)) {
      throw new Error(`Token ${tokenId} is not allowed for the current matcher state.`);
    }

    const tokenText = this.tokenizer.idToText.get(tokenId);
    if (tokenText === undefined) {
      throw new Error(`Unknown token id: ${tokenId}`);
    }

    matcher.prefix += tokenText;
    matcher.pendingFfTokens = this.fastForwardTokens(matcher);

    if (matcher.candidates.includes(matcher.prefix)) {
      matcher.stopped = true;
      matcher.stopReason = 'matched';
      matcher.pendingFfTokens = [];
    }
  }

  private allowedTokenIds(matcher: MatcherState): number[] {
    const allowed: number[] = [];
    for (const [tokenId, tokenText] of this.tokenizer.idToText) {
      const next = matcher.prefix + tokenText;
      if (matcher.candidates.some((candidate) => candidate.startsWith(next))) {
        allowed.push(tokenId);
      }
    }
    return allowed.sort((a, b) => a - b);
  }

  private fastForwardTokens(matcher: MatcherState): number[] {
    const possible = matcher.candidates.filter((candidate) => candidate.startsWith(matcher.prefix));
    if (possible.length !== 1) {
      return [];
    }

    const remaining = possible[0].slice(matcher.prefix.length);
    if (remaining.length === 0) {
      return [];
    }

    const tokenId = this.tokenizer.textToId.get(remaining);
    return tokenId === undefined ? [] : [tokenId];
  }

  private commitResult(matcher: MatcherState): CommitResult {
    return {
      stopped: matcher.stopped,
      stopReason: matcher.stopReason,
      ffTokens: [...matcher.pendingFfTokens],
      temperature: undefined
    };
  }

  private matcher(matcherId: number): MatcherState {
    const matcher = this.matchers.get(matcherId);
    if (!matcher) {
      throw new Error(`Unknown matcher id: ${matcherId}`);
    }
    return matcher;
  }
}
