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

export function setupAPIHandlers() {
  ipcMain.handle('llm:stream', async (event, payload: LLMStreamPayload) => {
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
