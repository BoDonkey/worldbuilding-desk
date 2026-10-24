import type {AIProviderId} from '../../entityTypes';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMContextChunk {
  content: string;
  source: string;
  relevance?: number;
}

export interface LLMRequest {
  messages: LLMMessage[];
  context?: LLMContextChunk[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  responseFormat?: 'json';
  /**
   * The shape a structured reply must take. Local model servers use it to
   * constrain decoding (Slice 4.68); hosted providers ignore it. The reply is
   * still parsed and validated by the caller either way.
   */
  responseSchema?: LLMResponseSchema;
  think?: boolean | 'low' | 'medium' | 'high';
  /**
   * Defaults to true. Pass false for a request the author deliberately repeats and pays for
   * (e.g. brainstorming), so a retry reaches the model instead of replaying an earlier reply.
   */
  cache?: boolean;
}

/** A named JSON Schema (draft 2020-12, without `$schema`). Build one with `defineResponseSchema`. */
export interface LLMResponseSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMProvider {
  id: AIProviderId;
  name: string;
  generateCompletion(request: LLMRequest): Promise<LLMResponse>;
  streamCompletion?(request: LLMRequest): AsyncGenerator<string>;
}
