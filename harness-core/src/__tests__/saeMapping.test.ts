import { describe, expect, it } from 'vitest';
import { resolveSaeMappingsForModel } from '../saeMapping.js';

describe('SAE mapping', () => {
  it('maps supported Qwen model IDs to documented Qwen-Scope SAE repos', () => {
    const mappings = resolveSaeMappingsForModel('Qwen/Qwen3.5-27B-FP8');

    expect(mappings.map((mapping) => mapping.saeRepositoryId)).toEqual([
      'Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_50',
      'Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_100',
    ]);
    expect(mappings[1]).toMatchObject({
      baseModelId: 'Qwen/Qwen3.5-27B',
      family: 'qwen-scope',
      hookPoint: 'residual-stream',
      topK: 100,
      saeWidth: 81920,
      sourceUrl: 'https://huggingface.co/Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_100',
    });
  });

  it('returns no SAE mappings when no documented model match is available', () => {
    expect(resolveSaeMappingsForModel(undefined)).toEqual([]);
    expect(resolveSaeMappingsForModel('OpenAI/gpt-example')).toEqual([]);
  });
});
