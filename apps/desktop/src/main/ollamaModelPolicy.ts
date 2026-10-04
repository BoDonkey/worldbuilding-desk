/**
 * Private-local request policy for Ollama, enforced in the main process
 * before any manuscript context is sent. Mirrors the renderer's
 * `providerRoute.ts` (the packages cannot share code): a request may use only
 * a model that `/api/tags` lists as installed and that is not an Ollama cloud
 * model. With no model configured, the first installed local model is used.
 */

export interface OllamaModelEntry {
  name: string;
  cloud: boolean;
}

/** Ollama cloud models carry a `cloud` tag, e.g. `gpt-oss:120b-cloud` or `qwen3:cloud`. */
export function isOllamaCloudModelName(name: string): boolean {
  const tag = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : '';
  return /(^|-)cloud$/i.test(tag);
}

export function parseOllamaTags(data: unknown): OllamaModelEntry[] {
  const models = (data as {models?: unknown})?.models;
  if (!Array.isArray(models)) return [];
  return models.flatMap((entry) => {
    const record = entry as Record<string, unknown>;
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    if (!name) return [];
    return [{name, cloud: Boolean(record.remote_host || record.remote_model) || isOllamaCloudModelName(name)}];
  });
}

const withDefaultTag = (name: string) => (name.includes(':') ? name : `${name}:latest`);

const cloudRefusal = (model: string) =>
  new Error(
    `"${model}" is an Ollama cloud model, so your text would leave this computer. Private mode blocks it; choose a locally installed model in Settings.`
  );

export function resolveLocalOllamaModel(installed: readonly OllamaModelEntry[], configured?: string): string {
  const explicit = configured?.trim();
  if (explicit) {
    if (isOllamaCloudModelName(explicit)) throw cloudRefusal(explicit);
    const match = installed.find((entry) => withDefaultTag(entry.name) === withDefaultTag(explicit));
    if (!match) {
      throw new Error(
        `The Ollama model "${explicit}" is not installed on this computer. Pull it, or pick an installed model in Settings.`
      );
    }
    if (match.cloud) throw cloudRefusal(match.name);
    // Send the name as configured; Ollama resolves `qwen3` and `qwen3:latest` alike.
    return explicit;
  }
  const firstLocal = installed.find((entry) => !entry.cloud);
  if (!firstLocal) {
    throw new Error('No Ollama model is installed on this computer. Pull a local model, then try again.');
  }
  return firstLocal.name;
}

/** Reads the installed models at an already policy-checked loopback base URL and resolves the model. */
export async function resolveOllamaRequestModel(
  baseUrl: string,
  configured: string | undefined,
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {}
): Promise<string> {
  if (configured?.trim() && isOllamaCloudModelName(configured.trim())) throw cloudRefusal(configured.trim());
  const response = await (options.fetchImpl ?? fetch)(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
    signal: options.signal
  });
  if (!response.ok) {
    throw new Error(`Ollama model lookup failed: ${response.status} ${response.statusText}`);
  }
  return resolveLocalOllamaModel(parseOllamaTags(await response.json()), configured);
}
