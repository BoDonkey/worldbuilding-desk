import type {CraftEmbeddingContract, CraftQueryEmbedder} from './types';
import {
  BUNDLED_EMBEDDING_MODEL,
  loadBundledEmbeddingPipeline,
  type EmbeddingPipeline
} from '../embeddings/bundledEmbeddingModel';

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

/**
 * The query embedder uses the bundled search model. Dev and Cypress runs keep
 * the lexical fallback, matching project retrieval there.
 */
async function loadPipeline(contract: CraftEmbeddingContract): Promise<EmbeddingPipeline> {
  if (import.meta.env.DEV || (globalThis as {Cypress?: unknown}).Cypress) {
    throw new Error('Craft embeddings use lexical search in development and tests.');
  }
  if (contract.model !== BUNDLED_EMBEDDING_MODEL) {
    throw new Error(`Craft library expects ${contract.model}, but the app bundles ${BUNDLED_EMBEDDING_MODEL}.`);
  }
  return loadBundledEmbeddingPipeline();
}
