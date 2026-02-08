// apps/desktop/src/main/apiHandler.ts
import {ipcMain} from 'electron';
import {randomUUID} from 'node:crypto';
import {createStreamingAdapter, ProviderId, LLMRequestPayload} from './providers/ProviderRegistry';

type RendererMessage = LLMRequestPayload['messages'][number];
type RendererContextChunk = NonNullable<LLMRequestPayload['context']>[number];

interface LLMStreamPayload {
  providerId: ProviderId;
  apiKey: string;
  request: LLMRequestPayload;
  providerConfig?: {
    baseUrl?: string;
  };
  requestId?: string;
}

function validatePayload(payload: unknown): asserts payload is LLMStreamPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.providerId !== 'string' || p.providerId.trim().length === 0) {
    throw new Error('providerId must be provided');
  }

  // Validate apiKey
  if (typeof p.apiKey !== 'string' || p.apiKey.trim().length === 0) {
    throw new Error('apiKey must be a non-empty string');
  }

  // Validate request object
  if (!p.request || typeof p.request !== 'object') {
    throw new Error('request must be an object');
  }

  const request = p.request as Record<string, unknown>;

  // Validate maxTokens if provided
  if (request.maxTokens !== undefined) {
    if (typeof request.maxTokens !== 'number' || !Number.isInteger(request.maxTokens)) {
      throw new Error('maxTokens must be an integer');
    }
    if (request.maxTokens < 1 || request.maxTokens > 200000) {
      throw new Error('maxTokens must be between 1 and 200000');
    }
  }

  // Validate temperature if provided
  if (request.temperature !== undefined) {
    if (typeof request.temperature !== 'number' || isNaN(request.temperature)) {
      throw new Error('temperature must be a number');
    }
    if (request.temperature < 0 || request.temperature > 1) {
      throw new Error('temperature must be between 0 and 1');
    }
  }

  // Validate systemPrompt if provided
  if (request.systemPrompt !== undefined && typeof request.systemPrompt !== 'string') {
    throw new Error('systemPrompt must be a string');
  }

  if (request.model !== undefined && typeof request.model !== 'string') {
    throw new Error('model must be a string if provided');
  }

  if (request.context !== undefined && !Array.isArray(request.context)) {
    throw new Error('context must be an array if provided');
  }

  // Validate messages array
  if (!Array.isArray(request.messages)) {
    throw new Error('messages must be an array');
  }

  if (request.messages.length === 0) {
    throw new Error('messages array cannot be empty');
  }

  // Validate each message
  for (let i = 0; i < request.messages.length; i++) {
    const message = request.messages[i];
    
    if (!message || typeof message !== 'object') {
      throw new Error(`messages[${i}] must be an object`);
    }

    const msg = message as Record<string, unknown>;

    if (typeof msg.role !== 'string') {
      throw new Error(`messages[${i}].role must be a string`);
    }

    if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'system') {
      throw new Error(`messages[${i}].role must be 'user', 'assistant', or 'system'`);
    }

    if (typeof msg.content !== 'string') {
      throw new Error(`messages[${i}].content must be a string`);
    }
  }

  // Validate requestId if provided
  if (p.requestId !== undefined && typeof p.requestId !== 'string') {
    throw new Error('requestId must be a string');
  }

  if (p.providerConfig !== undefined) {
    const config = p.providerConfig as Record<string, unknown>;
    if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') {
      throw new Error('providerConfig.baseUrl must be a string if provided');
    }
  }
}

export function setupAPIHandlers() {
  ipcMain.handle('llm:stream', async (event, payload: LLMStreamPayload) => {
    validatePayload(payload);

    const {apiKey, providerId, request, requestId = randomUUID()} = payload;

    try {
      const adapter = createStreamingAdapter(providerId, {apiKey, request});
      const chunks: string[] = [];

      for await (const chunk of adapter.stream()) {
        chunks.push(chunk);
        event.sender.send('llm:stream:chunk', {requestId, text: chunk});
      }

      event.sender.send('llm:stream:complete', {requestId});
      return chunks.join('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      event.sender.send('llm:stream:error', {requestId, message});
      throw error;
    }
  });
}
