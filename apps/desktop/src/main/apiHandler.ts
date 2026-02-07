// apps/desktop/src/main/apiHandler.ts
import {ipcMain} from 'electron';
import {randomUUID} from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';

type RendererMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

interface LLMStreamPayload {
  apiKey: string;
  request: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    messages: RendererMessage[];
  };
  requestId?: string;
}

function isAnthropicMessage(
  message: RendererMessage
): message is {role: 'user' | 'assistant'; content: string} {
  return message.role === 'user' || message.role === 'assistant';
}

function validatePayload(payload: unknown): asserts payload is LLMStreamPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  const p = payload as Record<string, unknown>;

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
}

export function setupAPIHandlers() {
  ipcMain.handle('llm:stream', async (event, payload: LLMStreamPayload) => {
    // Validate payload from renderer to prevent misuse or crashes
    validatePayload(payload);
    
    const {apiKey, request, requestId = randomUUID()} = payload;
    const client = new Anthropic({apiKey});

    try {
      const anthropicMessages = request.messages.filter(isAnthropicMessage);

      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: anthropicMessages
      });

      const chunks: string[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          chunks.push(chunk.delta.text);
          event.sender.send('llm:stream:chunk', {
            requestId,
            text: chunk.delta.text
          });
        }
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
