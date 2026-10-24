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
  "The local model stopped at its response length limit, so no complete answer was used. Raise the maximum response length in the model server's settings, or Max response tokens in Settings, and try again.";

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
 * and the reply is parsed and validated by the feature either way. No token
 * cap unless the caller sets one, the same as Ollama.
 */
export function buildLocalServerChatPayload(
  request: LLMRequest,
  model: string | undefined,
  stream: boolean,
  options: {constrain?: boolean} = {}
) {
  const {systemPrompt} = foldContextIntoSystemPrompt(request);
  const schema = options.constrain === false ? undefined : request.responseSchema;
  return {
    ...(model ? {model} : {}),
    stream,
    ...(schema
      ? {response_format: {type: 'json_schema', json_schema: {name: schema.name, strict: true, schema: schema.schema}}}
      : {}),
    ...(typeof request.maxTokens === 'number' ? {max_tokens: request.maxTokens} : {}),
    ...(typeof request.temperature === 'number' ? {temperature: request.temperature} : {}),
    messages: [
      ...(systemPrompt ? [{role: 'system' as const, content: systemPrompt}] : []),
      ...request.messages.map((message) => ({role: message.role, content: message.content}))
    ]
  };
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
