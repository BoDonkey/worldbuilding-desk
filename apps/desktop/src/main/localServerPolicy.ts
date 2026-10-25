/**
 * Request rules for a local OpenAI-compatible server (KoboldCPP, LM Studio,
 * llama.cpp), enforced in the main process. Mirrors the renderer's
 * `services/llm/localServer.ts` (the packages cannot share code). The address
 * has already passed `resolveProviderBaseUrl`, which allows loopback only.
 */

export const LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE =
  "The local model stopped at its response length limit, so no complete answer was used. Load the model with a larger context size in the model server, or raise Maximum reply length in Settings if your server does not report its context size, and try again.";

/** Bounds for the author's Maximum reply length, checked on every IPC request. */
export const MIN_LOCAL_REPLY_TOKENS = 64;
export const MAX_LOCAL_REPLY_TOKENS = 131072;

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

/**
 * Reply length (Slice 4.75), as in the renderer: the context size minus a prompt
 * estimate that errs high, because KoboldCPP silently drops the start of a
 * prompt when prompt plus cap exceed the context.
 */
export const LOCAL_SERVER_PROMPT_MARGIN_TOKENS = 256;
export const LOCAL_SERVER_MIN_REPLY_TOKENS = 512;

export function estimateLocalPromptTokens(messages: ReadonlyArray<{content: string}>): number {
  let ascii = 0;
  let other = 0;
  for (const message of messages) {
    for (const char of message.content) {
      if (char.charCodeAt(0) < 128) ascii += 1;
      else other += 1;
    }
  }
  return Math.ceil(ascii / 3) + other + messages.length * 8;
}

export function parseLocalServerContextSize(data: unknown): number | undefined {
  const record = data as {default_generation_settings?: {n_ctx?: unknown}; n_ctx?: unknown; value?: unknown} | null;
  const size = record?.default_generation_settings?.n_ctx ?? record?.n_ctx ?? record?.value;
  return typeof size === 'number' && Number.isInteger(size) && size >= 256 ? size : undefined;
}

const CONTEXT_SIZE_PATHS = ['/props', '/api/extra/true_max_context_length'];

export async function readLocalServerContextSize(
  apiBase: string,
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {}
): Promise<number | undefined> {
  let origin: string;
  try {
    origin = new URL(apiBase).origin;
  } catch {
    return undefined;
  }
  for (const path of CONTEXT_SIZE_PATHS) {
    try {
      const response = await (options.fetchImpl ?? fetch)(`${origin}${path}`, {signal: options.signal});
      const size = response.ok ? parseLocalServerContextSize(await response.json()) : undefined;
      if (size) return size;
    } catch (error) {
      if ((error as {name?: unknown})?.name === 'AbortError') throw error;
    }
  }
  return undefined;
}

export class LocalServerContextFullError extends Error {
  constructor(promptTokens: number, contextSize: number) {
    super(
      `This request is too long for the local model: the prompt is about ${promptTokens.toLocaleString('en-US')} tokens, and the model's context holds ${contextSize.toLocaleString('en-US')}. It was not sent, because the server would drop the start of the prompt to make room. Load the model with a larger context size, or ask about less material.`
    );
    this.name = 'LocalServerContextFullError';
  }
}

export function planLocalReplyTokens(input: {
  contextSize?: number;
  promptTokens: number;
  requested?: number;
  fallback?: number;
}): number | undefined {
  const {contextSize, promptTokens, requested, fallback} = input;
  if (!contextSize) return requested ?? fallback;
  const available = contextSize - promptTokens - LOCAL_SERVER_PROMPT_MARGIN_TOKENS;
  const needed = Math.min(requested ?? LOCAL_SERVER_MIN_REPLY_TOKENS, LOCAL_SERVER_MIN_REPLY_TOKENS);
  if (available < needed) throw new LocalServerContextFullError(promptTokens, contextSize);
  return requested === undefined ? available : Math.min(requested, available);
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
