import {describe, expect, it} from 'vitest';
import {buildOllamaChatPayload} from '../../../../desktop/src/main/providers/ProviderRegistry';

describe('Electron Ollama payload', () => {
  it('maps renderer request options to the Ollama chat payload', () => {
    expect(
      buildOllamaChatPayload(
        {
          baseUrl: 'http://localhost:11434',
          request: {
            model: 'qwen3',
            maxTokens: 800,
            temperature: 0.2,
            responseFormat: 'json',
            think: false,
            systemPrompt: 'Return JSON only.',
            messages: [{role: 'user', content: 'Draft an item.'}]
          }
        },
        false
      )
    ).toEqual({
      model: 'qwen3',
      stream: false,
      think: false,
      format: 'json',
      options: {
        num_predict: 800,
        temperature: 0.2
      },
      messages: [
        {role: 'system', content: 'Return JSON only.'},
        {role: 'user', content: 'Draft an item.'}
      ]
    });
  });
});
