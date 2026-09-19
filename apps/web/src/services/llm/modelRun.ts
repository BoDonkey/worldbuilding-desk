import type {AIProviderId} from '../../entityTypes';

/**
 * Shared handling for an author-watched model run (Slice 4.40).
 *
 * Local (Ollama) thinking models stream their reasoning before the answer. Both the web and the
 * desktop Ollama adapters wrap every thinking chunk as `<think>…</think>`, so one reply arrives as
 * many small wrapped fragments followed by the answer. Some models instead emit a bare
 * `…</think>` with no opening tag. Thinking is shown to the author while it happens but is never
 * part of the answer: never saved, indexed, parsed as output, or sent back to the model.
 */

export type ModelRunPhase = 'waiting' | 'thinking' | 'answering';

export interface SplitModelOutput {
  thinking: string;
  answer: string;
  phase: ModelRunPhase;
}

const THINK_BLOCK = /<think>([\s\S]*?)(?:<\/think>|$)/gi;

export function splitModelOutput(raw: string): SplitModelOutput {
  let text = raw;
  let thinking = '';

  // A leading close tag with no opener: everything before it was thinking.
  const firstClose = text.search(/<\/think>/i);
  const firstOpen = text.search(/<think>/i);
  if (firstClose !== -1 && (firstOpen === -1 || firstClose < firstOpen)) {
    thinking += text.slice(0, firstClose);
    text = text.slice(firstClose + '</think>'.length);
  }

  const answer = text.replace(THINK_BLOCK, (_match, inner: string) => {
    thinking += inner;
    return '';
  });

  const trimmedAnswer = answer.replace(/^\s+/, '');
  const phase: ModelRunPhase = trimmedAnswer
    ? 'answering'
    : thinking
      ? 'thinking'
      : 'waiting';
  return {thinking, answer: trimmedAnswer, phase};
}

/**
 * The response cap protects spend on hosted providers. A local model costs nothing, so no cap is
 * sent: on thinking models a cap mostly let the reasoning consume the whole reply.
 */
export function resolveResponseTokenLimit(
  provider: AIProviderId | undefined,
  configured: number | undefined
): number | undefined {
  return provider === 'ollama' ? undefined : configured;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
