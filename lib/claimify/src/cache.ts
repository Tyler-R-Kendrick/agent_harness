type OptionalModelRegistry = {
  get_pipeline_files?: (task: string, modelId: string) => Promise<string[]> | string[];
  is_pipeline_cached?: (task: string, modelId: string) => Promise<boolean> | boolean;
};

export async function getPipelineFiles(
  registry: unknown,
  task: string,
  modelId: string,
): Promise<string[]> {
  const modelRegistry = registry as OptionalModelRegistry;
  if (typeof modelRegistry?.get_pipeline_files !== 'function') {
    return [];
  }
  return modelRegistry.get_pipeline_files(task, modelId);
}

export async function isPipelineCached(
  registry: unknown,
  task: string,
  modelId: string,
): Promise<boolean> {
  const modelRegistry = registry as OptionalModelRegistry;
  if (typeof modelRegistry?.is_pipeline_cached !== 'function') {
    return false;
  }
  return modelRegistry.is_pipeline_cached(task, modelId);
}
