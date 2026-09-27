import type {LLMContextChunk, LLMRequest} from './types';

/** Used when a request carries context but no system prompt of its own. */
export const DEFAULT_SYSTEM_PROMPT =
  'You are an AI assistant helping authors create LitRPG/GameLit content.';

/**
 * The one rendering of `LLMRequest.context` for every provider: the system
 * prompt followed by `[Source: label]` blocks, so trust labels reach the model
 * the same way whichever provider or process sends the request.
 */
export function buildSystemPromptWithContext(
  context: LLMContextChunk[] | undefined,
  basePrompt: string | undefined
): string {
  let prompt = basePrompt || DEFAULT_SYSTEM_PROMPT;
  if (context && context.length > 0) {
    prompt += '\n\nRelevant context from the project:\n';
    context.forEach((chunk) => {
      prompt += `\n[Source: ${chunk.source}]\n${chunk.content}\n`;
    });
  }
  return prompt;
}

/**
 * Moves `context` into `systemPrompt` for transports that only carry a system
 * prompt and messages (local Ollama, the desktop main process). Requests
 * without context are returned unchanged.
 */
export function foldContextIntoSystemPrompt<T extends Pick<LLMRequest, 'context' | 'systemPrompt'>>(
  request: T
): T {
  if (!request.context || request.context.length === 0) return request;
  const folded = {...request, systemPrompt: buildSystemPromptWithContext(request.context, request.systemPrompt)};
  delete folded.context;
  return folded;
}
