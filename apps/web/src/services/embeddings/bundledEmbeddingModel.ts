/*
 * The search (embedding) model ships with the app in `models/` (copied there
 * by scripts/prepare-embedding-model.mjs). This configures transformers.js to
 * load only those files and the bundled WebAssembly runtime, so the app never
 * downloads a model or runtime at run time.
 */

export const BUNDLED_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export type EmbeddingPipeline = (text: string, options?: Record<string, unknown>) => Promise<unknown>;

/** The bundled files' location next to the running page: works under file:// and http. */
export function bundledModelsUrl(baseUri: string): URL {
  return new URL('models/', baseUri);
}

interface TransformersEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  localModelPath: string;
  useBrowserCache: boolean;
  useWasmCache: boolean;
  backends: {onnx: {wasm?: {wasmPaths?: unknown; numThreads?: number}}};
}

/** Points transformers.js at the bundled model and runtime and turns remote loading off. */
export function configureBundledEmbeddingEnv(env: TransformersEnv, baseUri: string): void {
  const models = bundledModelsUrl(baseUri);
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  // A path, not a URL: transformers.js only reads local files from non-URL paths.
  env.localModelPath = models.pathname;
  // The files are already on disk; caching copies would only use space.
  env.useBrowserCache = false;
  // Let the runtime load its own files from the bundle instead of via blob URLs.
  env.useWasmCache = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = {
      mjs: new URL('onnxruntime/ort-wasm-simd-threaded.asyncify.mjs', models).href,
      wasm: new URL('onnxruntime/ort-wasm-simd-threaded.asyncify.wasm', models).href
    };
    // Threads need cross-origin isolation, which the app window does not have.
    wasm.numThreads = 1;
  }
}

let pipelinePromise: Promise<EmbeddingPipeline> | null = null;

/** The bundled feature-extraction pipeline, loaded once. Rejects if the files are missing. */
export function loadBundledEmbeddingPipeline(): Promise<EmbeddingPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import('@huggingface/transformers');
      configureBundledEmbeddingEnv(transformers.env as unknown as TransformersEnv, document.baseURI);
      return (await transformers.pipeline('feature-extraction', BUNDLED_EMBEDDING_MODEL, {
        local_files_only: true,
        dtype: 'q8'
      })) as unknown as EmbeddingPipeline;
    })();
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}
