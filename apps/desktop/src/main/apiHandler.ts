// apps/desktop/src/main/apiHandler.ts
import { ipcMain } from 'electron';
import Anthropic from '@anthropic-ai/sdk';

export function setupAPIHandlers() {
  ipcMain.handle('llm:stream', async (event, { apiKey, request }) => {
    const client = new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.7,
      system: request.systemPrompt,
      messages: request.messages.filter((m: any) => m.role !== 'system'),
    });

    const chunks: string[] = [];
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        chunks.push(chunk.delta.text);
        // Send chunk to renderer
        event.sender.send('llm:stream:chunk', chunk.delta.text);
      }
    }

    return chunks.join('');
  });
}