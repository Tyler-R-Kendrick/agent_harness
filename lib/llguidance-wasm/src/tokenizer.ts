import type { LlgSessionOptions } from './types.js';

export interface LoadedTokenizer {
  idToText: Map<number, string>;
  textToId: Map<string, number>;
  vocabSize: number;
  eosTokenIds: number[];
  bosTokenId?: number;
  unkTokenId?: number;
}

export function loadTokenizer(tokenizerJson: string, options: LlgSessionOptions = {}): LoadedTokenizer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(tokenizerJson) as unknown;
  } catch (error) {
    throw new Error(`Invalid tokenizer JSON: ${errorMessage(error)}`);
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid tokenizer JSON: root value must be an object.');
  }

  const idToText = new Map<number, string>();
  const textToId = new Map<string, number>();
  readModelVocab(parsed.model, idToText, textToId);
  readAddedTokens(parsed.added_tokens, idToText, textToId);

  if (idToText.size === 0) {
    throw new Error('Invalid tokenizer JSON: no model.vocab or added_tokens entries were found.');
  }

  const detectedEos = detectSpecialTokenIds(parsed.eos_token, textToId);
  const eosTokenIds = options.eosTokenIds ? [...options.eosTokenIds] : detectedEos;

  return {
    idToText,
    textToId,
    vocabSize: Math.max(...idToText.keys()) + 1,
    eosTokenIds,
    ...(options.bosTokenId !== undefined ? { bosTokenId: options.bosTokenId } : {}),
    ...(options.unkTokenId !== undefined ? { unkTokenId: options.unkTokenId } : {})
  };
}

function readModelVocab(model: unknown, idToText: Map<number, string>, textToId: Map<string, number>): void {
  if (!isRecord(model) || !isRecord(model.vocab)) {
    return;
  }

  for (const [text, id] of Object.entries(model.vocab)) {
    if (typeof id === 'number' && Number.isInteger(id) && id >= 0) {
      setToken(idToText, textToId, id, text);
    }
  }
}

function readAddedTokens(value: unknown, idToText: Map<number, string>, textToId: Map<string, number>): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const token of value) {
    if (isRecord(token) && typeof token.id === 'number' && typeof token.content === 'string') {
      setToken(idToText, textToId, token.id, token.content);
    }
  }
}

function detectSpecialTokenIds(value: unknown, textToId: Map<string, number>): number[] {
  if (typeof value === 'string') {
    const id = textToId.get(value);
    return id === undefined ? [] : [id];
  }

  if (isRecord(value) && typeof value.content === 'string') {
    const id = textToId.get(value.content);
    return id === undefined ? [] : [id];
  }

  return [];
}

function setToken(idToText: Map<number, string>, textToId: Map<string, number>, id: number, text: string): void {
  idToText.set(id, text);
  textToId.set(text, id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
