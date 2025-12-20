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
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  generateCompletion(request: LLMRequest): Promise<LLMResponse>;
  streamCompletion?(request: LLMRequest): AsyncGenerator<string>;
}