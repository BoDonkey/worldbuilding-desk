import type {LLMProvider, LLMRequest, LLMResponse} from '../types';
import {
  assertLocalServerAddress,
  assertLocalServerResponseComplete,
  buildLocalServerChatPayload,
  fetchLocalServer,
  localServerAcceptsSchema,
  localServerApiBase,
  noteSchemaRefusal,
  resolveLocalServerModel
} from '../localServer';

interface LocalOpenAIProviderConfig {
  baseUrl?: string;
  model?: string;
}

/**
 * A local OpenAI-compatible server (KoboldCPP, LM Studio, llama.cpp). Uses the
 * OpenAI request shape but none of the hosted OpenAI provider's code, key, or
 * disclosure: requests go only to a loopback address.
 */
export class LocalOpenAIProvider implements LLMProvider {
  id = 'local-openai' as const;
  name = 'Local model server';
  private readonly baseUrl?: string;
  private readonly model?: string;

  constructor(config: LocalOpenAIProviderConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.send(request, false);
    const data = await response.json();
    const choice = data.choices?.[0];
    assertLocalServerResponseComplete(choice?.finish_reason);
    const reasoning = choice?.message?.reasoning_content;
    const content = choice?.message?.content ?? '';
    return {
      content: typeof reasoning === 'string' && reasoning ? `<think>${reasoning}</think>${content}` : content,
      usage: data.usage
        ? {promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens}
        : undefined
    };
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const response = await this.send(request, true);
    if (!response.body) throw new Error('The local model server sent an empty response.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: unknown;

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const choice = JSON.parse(data).choices?.[0];
          finishReason = choice?.finish_reason ?? finishReason;
          // LM Studio and llama.cpp stream a thinking model's reasoning separately; it is shown
          // the same way as Ollama's and never becomes part of the answer.
          const reasoning = choice?.delta?.reasoning_content;
          if (typeof reasoning === 'string' && reasoning) yield `<think>${reasoning}</think>`;
          const delta = choice?.delta?.content;
          if (typeof delta === 'string' && delta) yield delta;
        } catch {
          // Ignore malformed chunks.
        }
      }
    }
    assertLocalServerResponseComplete(finishReason);
  }

  private async send(request: LLMRequest, stream: boolean): Promise<Response> {
    const apiBase = localServerApiBase(request.baseUrl ?? this.baseUrl);
    assertLocalServerAddress(apiBase);
    const model = await resolveLocalServerModel(apiBase, request.model ?? this.model, {signal: request.signal});
    const post = (constrain: boolean) =>
      fetchLocalServer(apiBase, '/chat/completions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(buildLocalServerChatPayload(request, model, stream, {constrain})),
        signal: request.signal
      });
    const constrain = Boolean(request.responseSchema) && localServerAcceptsSchema(apiBase);
    try {
      return await post(constrain);
    } catch (error) {
      // A server that does not take a schema still gets the request; the reply is validated as before.
      if (constrain && noteSchemaRefusal(apiBase, error)) return post(false);
      throw error;
    }
  }
}
