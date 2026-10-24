/**
 * Request rules for a local OpenAI-compatible server (KoboldCPP, LM Studio,
 * llama.cpp), enforced in the main process. Mirrors the renderer's
 * `services/llm/localServer.ts` (the packages cannot share code). The address
 * has already passed `resolveProviderBaseUrl`, which allows loopback only.
 */

export const LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE =
  "The local model stopped at its response length limit, so no complete answer was used. Raise the maximum response length in the model server's settings, or Max response tokens in Settings, and try again.";

/** An address with no path gets `/v1`, as in the renderer. */
export function localServerApiBase(baseUrl: string): string {
  const raw = baseUrl.trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    return url.pathname === '' || url.pathname === '/' ? `${url.origin}/v1` : raw;
  } catch {
    return raw;
  }
}

export function parseLocalServerModels(data: unknown): string[] {
  const entries = (data as {data?: unknown})?.data;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const id = (entry as {id?: unknown})?.id;
    return typeof id === 'string' && id.trim() ? [id.trim()] : [];
  });
}

/** The configured model, else the first one the server lists, else none (the server's loaded model). */
export async function resolveLocalServerRequestModel(
  baseUrl: string,
  configured: string | undefined,
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {}
): Promise<string | undefined> {
  const explicit = configured?.trim();
  if (explicit) return explicit;
  try {
    const response = await (options.fetchImpl ?? fetch)(`${localServerApiBase(baseUrl)}/models`, {
      signal: options.signal
    });
    return response.ok ? parseLocalServerModels(await response.json())[0] : undefined;
  } catch (error) {
    if ((error as {name?: unknown})?.name === 'AbortError') throw error;
    return undefined;
  }
}

/** Servers that refused a constrained request this session, as in the renderer. */
const serversWithoutSchemaSupport = new Set<string>();

export function resetLocalServerSchemaSupport(): void {
  serversWithoutSchemaSupport.clear();
}

export function localServerAcceptsSchema(apiBase: string): boolean {
  return !serversWithoutSchemaSupport.has(apiBase);
}

export function noteSchemaRefusal(apiBase: string, error: unknown): boolean {
  const status = (error as {status?: unknown})?.status;
  if (status !== 400 && status !== 422) return false;
  serversWithoutSchemaSupport.add(apiBase);
  return true;
}

export class LocalServerStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'LocalServerStatusError';
    this.status = status;
  }
}

export function assertLocalServerResponseComplete(finishReason: unknown): void {
  if (typeof finishReason === 'string' && finishReason.toLowerCase() === 'length') {
    throw new Error(LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE);
  }
}

/** Sends a request, turning a refused connection or an error status into a plain sentence. */
export async function fetchLocalServer(apiBase: string, path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, init);
  } catch (error) {
    if ((error as {name?: unknown})?.name === 'AbortError') throw error;
    throw new Error(`Could not connect to the local model server at ${apiBase}. Check that it is running.`, {
      cause: error
    });
  }
  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as {error?: unknown; detail?: unknown};
        const error = parsed.error ?? parsed.detail;
        const message = typeof error === 'string' ? error : (error as {message?: unknown})?.message;
        detail = typeof message === 'string' ? message : '';
      } catch {
        detail = text;
      }
    } catch {
      // No readable body.
    }
    detail = detail.trim().slice(0, 200);
    throw new LocalServerStatusError(
      response.status,
      `The local model server responded with ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${detail ? `: ${detail}` : '.'}`
    );
  }
  return response;
}
