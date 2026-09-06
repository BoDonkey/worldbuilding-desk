import type {CraftEmbeddingContract, CraftQueryEmbedder} from './types';

type EmbeddingPipeline = (text: string, options?: Record<string, unknown>) => Promise<unknown>;

export function createCraftQueryEmbedder(
  contract: CraftEmbeddingContract
): CraftQueryEmbedder {
  let pipelinePromise: Promise<EmbeddingPipeline> | null = null;

  return {
    contract,
    async embed(text: string): Promise<number[]> {
      if (!pipelinePromise) {
        pipelinePromise = loadPipeline(contract);
      }
      const pipeline = await pipelinePromise;
      const output = await pipeline(text, {
        pooling: 'mean',
        normalize: contract.normalization === 'l2'
      }) as {data?: Float32Array | number[] | {data?: ArrayLike<number>}};
      const raw = output?.data;
      const data = raw instanceof Float32Array
        ? raw
        : Array.isArray(raw)
          ? Float32Array.from(raw)
          : new Float32Array(raw?.data ?? []);
      return Array.from(data);
    }
  };
}

async function loadPipeline(contract: CraftEmbeddingContract): Promise<EmbeddingPipeline> {
  const transformers = await import('@huggingface/transformers');
  return await transformers.pipeline('feature-extraction', contract.model, {
    revision: contract.version,
    local_files_only: true
  }) as EmbeddingPipeline;
}
