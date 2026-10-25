import type {LLMRequest} from './types';
import {PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';
import {isLoopbackUrl, LOCAL_SERVER_REMOTE_REASON} from './providerRoute';
import {foldContextIntoSystemPrompt} from './contextPrompt';

/**
 * A local server that speaks the OpenAI chat-completions API: KoboldCPP,
 * LM Studio, or the llama.cpp server (Slice 4.67). It never takes an API key
 * and may only be reached at a loopback address, so it is a private-local
 * route like Ollama. The desktop main process mirrors these rules in
 * `apps/desktop/src/main/localServerPolicy.ts`.
 */

const DEFAULT_LOCAL_SERVER_URL = PROVIDER_DEFAULT_BASE_URLS['local-openai'] ?? 'http://localhost:5001/v1';

export const LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE =
  "The local model stopped at its response length limit, so no complete answer was used. Load the model with a larger context size in the model server, or raise Maximum reply length in Settings if your server does not report its context size, and try again.";

/**
 * The API base requests are made against. An address with no path gets `/v1`,
 * so `http://127.0.0.1:8080` and `http://127.0.0.1:8080/v1` reach the same endpoints.
 */
export function localServerApiBase(baseUrl?: string): string {
  const raw = (baseUrl?.trim() || DEFAULT_LOCAL_SERVER_URL).replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    return url.pathname === '' || url.pathname === '/' ? `${url.origin}/v1` : raw;
  } catch {
    return raw;
  }
}

export function assertLocalServerAddress(apiBase: string): void {
  if (!isLoopbackUrl(apiBase)) throw new Error(LOCAL_SERVER_REMOTE_REASON);
}

/** Model ids from `GET /models` (`{data: [{id}]}`), in the order the server lists them. */
export function parseLocalServerModels(data: unknown): string[] {
  const entries = (data as {data?: unknown})?.data;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const id = (entry as {id?: unknown})?.id;
    return typeof id === 'string' && id.trim() ? [id.trim()] : [];
  });
}

/** The models the server lists, or null when it does not answer the listing. */
export async function listLocalServerModels(
  apiBase: string,
  options: {signal?: AbortSignal} = {}
): Promise<string[] | null> {
  try {
    const response = await fetch(`${apiBase}/models`, {signal: options.signal});
    return response.ok ? parseLocalServerModels(await response.json()) : null;
  } catch (error) {
    if ((error as {name?: unknown})?.name === 'AbortError') throw error;
    return null;
  }
}

/**
 * The model a request names: the configured one, else the first the server
 * lists. Undefined when neither is known; KoboldCPP and llama.cpp then use the
 * model they have loaded.
 */
export async function resolveLocalServerModel(
  apiBase: string,
  configured: string | undefined,
  options: {signal?: AbortSignal} = {}
): Promise<string | undefined> {
  const explicit = configured?.trim();
  if (explicit) return explicit;
  return (await listLocalServerModels(apiBase, options))?.[0];
}

/**
 * Servers that refused a constrained request this session. They get the
 * request again without a schema, and later requests skip the schema.
 */
const serversWithoutSchemaSupport = new Set<string>();

/** For tests. */
export function resetLocalServerSchemaSupport(): void {
  serversWithoutSchemaSupport.clear();
}

export function localServerAcceptsSchema(apiBase: string): boolean {
  return !serversWithoutSchemaSupport.has(apiBase);
}

/**
 * True when a constrained request failed in a way that means the server does
 * not take `response_format: json_schema` (a 400 or 422). The server is then
 * remembered for the session and the request should be sent again without it.
 */
export function noteSchemaRefusal(apiBase: string, error: unknown): boolean {
  const status = (error as {status?: unknown})?.status;
  if (status !== 400 && status !== 422) return false;
  serversWithoutSchemaSupport.add(apiBase);
  return true;
}

/**
 * `response_format: json_schema` is the one structured-output form KoboldCPP,
 * LM Studio, and the llama.cpp server share (Slice 4.68; KoboldCPP 1.123
 * enforces it, while its `json_object` mode returns JSON of any shape). It is
 * sent only with a request's schema and only to a server that has not refused
 * it. Plain `responseFormat: 'json'` adds nothing: the prompt asks for JSON
 * and the reply is parsed and validated by the feature either way. The token
 * cap is the caller's unless `options.maxTokens` replaces it (see
 * `planLocalReplyTokens`).
 */
export function buildLocalServerChatPayload(
  request: LLMRequest,
  model: string | undefined,
  stream: boolean,
  options: {constrain?: boolean; maxTokens?: number} = {}
) {
  const {systemPrompt} = foldContextIntoSystemPrompt(request);
  const schema = options.constrain === false ? undefined : request.responseSchema;
  const maxTokens = 'maxTokens' in options ? options.maxTokens : request.maxTokens;
  return {
    ...(model ? {model} : {}),
    stream,
    ...(schema
      ? {response_format: {type: 'json_schema', json_schema: {name: schema.name, strict: true, schema: schema.schema}}}
      : {}),
    ...(typeof maxTokens === 'number' ? {max_tokens: maxTokens} : {}),
    ...(typeof request.temperature === 'number' ? {temperature: request.temperature} : {}),
    messages: [
      ...(systemPrompt ? [{role: 'system' as const, content: systemPrompt}] : []),
      ...request.messages.map((message) => ({role: message.role, content: message.content}))
    ]
  };
}

/**
 * Reply length (Slice 4.75). With no `max_tokens`, KoboldCPP stops every reply
 * at 2,048 tokens, a thinking model's reasoning included. Asking for more than
 * the context has room for is worse: KoboldCPP 1.123 then drops the start of the
 * prompt without saying so (checked: an 11,137-token prompt with an 8,000-token
 * cap reached the model as its last 8,384 tokens, system prompt gone). So the
 * cap is the context size minus a prompt estimate that errs high, and a request
 * that leaves too little room is not sent.
 */
export const LOCAL_SERVER_PROMPT_MARGIN_TOKENS = 256;

export const LOCAL_SERVER_MIN_REPLY_TOKENS = 512;

/**
 * Prompt tokens, estimated high without a tokenizer: three ASCII characters per
 * token (English prose measures about 3.7 on KoboldCPP's Qwen tokenizer) and one
 * per other character, plus a few per message for the chat template.
 */
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

/**
 * The context size from `GET /props` (llama.cpp, and KoboldCPP, which mirrors
 * it) or KoboldCPP's own `GET /api/extra/true_max_context_length`.
 */
export function parseLocalServerContextSize(data: unknown): number | undefined {
  const record = data as {default_generation_settings?: {n_ctx?: unknown}; n_ctx?: unknown; value?: unknown} | null;
  const size = record?.default_generation_settings?.n_ctx ?? record?.n_ctx ?? record?.value;
  return typeof size === 'number' && Number.isInteger(size) && size >= 256 ? size : undefined;
}

const CONTEXT_SIZE_PATHS = ['/props', '/api/extra/true_max_context_length'];

/** The loaded model's context size, or undefined when the server does not report one (LM Studio, for example). */
export async function readLocalServerContextSize(
  apiBase: string,
  options: {signal?: AbortSignal} = {}
): Promise<number | undefined> {
  let origin: string;
  try {
    origin = new URL(apiBase).origin;
  } catch {
    return undefined;
  }
  for (const path of CONTEXT_SIZE_PATHS) {
    try {
      const response = await fetch(`${origin}${path}`, {signal: options.signal});
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

/**
 * The `max_tokens` to send. With a known context size: whatever the prompt
 * leaves (a caller's smaller cap is kept), and an error when that is less than
 * the reply needs. Without one: the caller's cap, else the author's Maximum
 * reply length setting, else none (the server's own default).
 */
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
    const detail = await readServerError(response);
    throw new LocalServerStatusError(
      response.status,
      `The local model server responded with ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${detail ? `: ${detail}` : '.'}`
    );
  }
  return response;
}

export class LocalServerStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'LocalServerStatusError';
    this.status = status;
  }
}

async function readServerError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    let message: unknown = text;
    try {
      const parsed = JSON.parse(text) as {error?: unknown; detail?: unknown};
      const error = parsed.error ?? parsed.detail;
      message = typeof error === 'string' ? error : (error as {message?: unknown})?.message ?? '';
    } catch {
      // Plain-text error body.
    }
    return typeof message === 'string' ? message.trim().slice(0, 200) : '';
  } catch {
    return '';
  }
}
