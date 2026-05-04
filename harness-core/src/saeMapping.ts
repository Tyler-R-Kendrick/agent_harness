export interface SaeMapping {
  family: 'qwen-scope';
  baseModelId: string;
  saeRepositoryId: string;
  sourceUrl: string;
  hookPoint: 'residual-stream';
  topK: number;
  saeWidth: number;
  layersCovered?: string;
  hiddenSize?: number;
  status: 'documented-static-mapping';
}

const QWEN_SCOPE_BASE_URL = 'https://huggingface.co';

const QWEN_SCOPE_MAPPINGS: SaeMapping[] = [
  qwenScope('Qwen/Qwen3.5-27B', 'Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_50', 50, 81920, '0-63', 5120),
  qwenScope('Qwen/Qwen3.5-27B', 'Qwen/SAE-Res-Qwen3.5-27B-W80K-L0_100', 100, 81920, '0-63', 5120),
  qwenScope('Qwen/Qwen3.5-2B-Base', 'Qwen/SAE-Res-Qwen3.5-2B-Base-W32K-L0_50', 50, 32768),
  qwenScope('Qwen/Qwen3.5-2B-Base', 'Qwen/SAE-Res-Qwen3.5-2B-Base-W32K-L0_100', 100, 32768),
  qwenScope('Qwen/Qwen3.5-9B-Base', 'Qwen/SAE-Res-Qwen3.5-9B-Base-W64K-L0_50', 50, 65536),
  qwenScope('Qwen/Qwen3.5-9B-Base', 'Qwen/SAE-Res-Qwen3.5-9B-Base-W64K-L0_100', 100, 65536),
  qwenScope('Qwen/Qwen3.5-35B-A3B-Base', 'Qwen/SAE-Res-Qwen3.5-35B-A3B-Base-W32K-L0_50', 50, 32768),
  qwenScope('Qwen/Qwen3.5-35B-A3B-Base', 'Qwen/SAE-Res-Qwen3.5-35B-A3B-Base-W128K-L0_100', 100, 131072),
  qwenScope('Qwen/Qwen3-1.7B-Base', 'Qwen/SAE-Res-Qwen3-1.7B-Base-W32K-L0_50', 50, 32768),
  qwenScope('Qwen/Qwen3-1.7B-Base', 'Qwen/SAE-Res-Qwen3-1.7B-Base-W32K-L0_100', 100, 32768),
  qwenScope('Qwen/Qwen3-8B-Base', 'Qwen/SAE-Res-Qwen3-8B-Base-W64K-L0_50', 50, 65536, '0-35', 4096),
  qwenScope('Qwen/Qwen3-8B-Base', 'Qwen/SAE-Res-Qwen3-8B-Base-W64K-L0_100', 100, 65536, '0-35', 4096),
  qwenScope('Qwen/Qwen3-30B-A3B-Base', 'Qwen/SAE-Res-Qwen3-30B-A3B-Base-W32K-L0_50', 50, 32768),
  qwenScope('Qwen/Qwen3-30B-A3B-Base', 'Qwen/SAE-Res-Qwen3-30B-A3B-Base-W128K-L0_100', 100, 131072),
];

export function resolveSaeMappingsForModel(modelId: string | undefined): SaeMapping[] {
  if (!modelId?.trim()) return [];
  const normalizedModel = normalizeModelId(modelId);
  return QWEN_SCOPE_MAPPINGS
    .filter((mapping) => {
      const normalizedBase = normalizeModelId(mapping.baseModelId);
      return normalizedModel === normalizedBase
        || normalizedModel.startsWith(`${normalizedBase}-`)
        || normalizedBase.startsWith(`${normalizedModel}-`);
    })
    .map((mapping) => ({ ...mapping }));
}

function qwenScope(
  baseModelId: string,
  saeRepositoryId: string,
  topK: number,
  saeWidth: number,
  layersCovered?: string,
  hiddenSize?: number,
): SaeMapping {
  return {
    family: 'qwen-scope',
    baseModelId,
    saeRepositoryId,
    sourceUrl: `${QWEN_SCOPE_BASE_URL}/${saeRepositoryId}`,
    hookPoint: 'residual-stream',
    topK,
    saeWidth,
    ...(layersCovered ? { layersCovered } : {}),
    ...(hiddenSize ? { hiddenSize } : {}),
    status: 'documented-static-mapping',
  };
}

function normalizeModelId(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/-(?:instruct|chat|base|fp8|gptq-int4|awq|gguf)$/g, '');
}
