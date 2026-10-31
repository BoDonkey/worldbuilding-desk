import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {PACKAGED_RENDERER_CSP} from '../../../rendererCsp';
import {BUNDLED_EMBEDDING_MODEL, bundledModelsUrl, configureBundledEmbeddingEnv} from './bundledEmbeddingModel';

const packagedPage = 'file:///Applications/SagaSpine.app/Contents/Resources/renderer/index.html';

function freshEnv() {
  return {
    allowLocalModels: false,
    allowRemoteModels: true,
    localModelPath: '/models/',
    useBrowserCache: true,
    useWasmCache: true,
    backends: {onnx: {wasm: {} as {wasmPaths?: unknown; numThreads?: number}}}
  };
}

describe('configureBundledEmbeddingEnv', () => {
  it('loads only bundled files next to the packaged page', () => {
    const env = freshEnv();
    configureBundledEmbeddingEnv(env, packagedPage);
    expect(env.allowRemoteModels).toBe(false);
    expect(env.allowLocalModels).toBe(true);
    expect(env.localModelPath).toBe('/Applications/SagaSpine.app/Contents/Resources/renderer/models/');
    expect(env.backends.onnx.wasm.wasmPaths).toEqual({
      mjs: 'file:///Applications/SagaSpine.app/Contents/Resources/renderer/models/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs',
      wasm: 'file:///Applications/SagaSpine.app/Contents/Resources/renderer/models/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm'
    });
    expect(env.backends.onnx.wasm.numThreads).toBe(1);
  });

  it('resolves the models folder under a dev server too', () => {
    expect(bundledModelsUrl('http://localhost:5173/workspace').href).toBe('http://localhost:5173/models/');
  });
});

describe('bundled model files', () => {
  const webRoot = path.resolve(__dirname, '../../..');
  const manifest = JSON.parse(readFileSync(path.join(webRoot, 'embedding-model', 'manifest.json'), 'utf8')) as {
    model: string;
    revision: string;
    files: Record<string, string>;
    runtime: {files: string[]};
  };

  it('match the model the app and the craft library use', () => {
    expect(manifest.model).toBe(BUNDLED_EMBEDDING_MODEL);
    expect(manifest.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(manifest.files)).toContain('onnx/model_quantized.onnx');
    expect(manifest.runtime.files).toEqual([
      'ort-wasm-simd-threaded.asyncify.mjs',
      'ort-wasm-simd-threaded.asyncify.wasm'
    ]);
    const craft = readFileSync(path.join(webRoot, 'src', 'generated', 'craftLibrary.generated.data.json'), 'utf8');
    expect(craft.slice(0, 400)).toContain(`"model":"${BUNDLED_EMBEDDING_MODEL}"`);
  });

  it('ship with their licenses and an attribution notice', () => {
    const notice = readFileSync(path.join(webRoot, 'embedding-model', 'NOTICE.txt'), 'utf8');
    expect(notice).toContain(manifest.revision);
    expect(readFileSync(path.join(webRoot, 'embedding-model', 'LICENSE-Apache-2.0.txt'), 'utf8')).toContain('Apache License');
    expect(readFileSync(path.join(webRoot, 'embedding-model', 'LICENSE-onnxruntime.txt'), 'utf8')).toContain('MIT License');
  });

  it('need no download host in the packaged renderer policy', () => {
    expect(PACKAGED_RENDERER_CSP).not.toMatch(/huggingface|hf\.co|jsdelivr/);
  });
});
