import type {PromptBreakdown} from '../../services/llm/contextBudget';
import type {ModelContextSize} from '../../services/llm/modelContextSize';

/**
 * The whole prompt against the model's context (Slice 4.72): instructions,
 * conversation, project context, and what is left for the reply. Estimates
 * run high, about three characters per token.
 */
export function PromptTokenSummary({
  breakdown,
  size,
  className
}: {
  breakdown: PromptBreakdown;
  size: ModelContextSize | null;
  className?: string;
}) {
  const context = breakdown.sections.reduce((sum, section) => sum + section.tokens, 0);
  const parts = [
    `instructions ~${breakdown.instructionsTokens.toLocaleString()}`,
    breakdown.conversationTokens > 0 ? `conversation ~${breakdown.conversationTokens.toLocaleString()}` : null,
    `project context ~${context.toLocaleString()}`
  ].filter(Boolean);
  const room = size ? size.tokens - breakdown.totalTokens : null;
  return (
    <p className={className} aria-label='Prompt size'>
      Prompt: about {breakdown.totalTokens.toLocaleString()} tokens
      {size ? ` of the model’s ${size.tokens.toLocaleString()}${size.source === 'assumed' ? ' (assumed)' : ''}` : ''} ({parts.join(', ')}).
      {room !== null && (room > 0 ? ` About ${room.toLocaleString()} left for the reply.` : ' No room is left for the reply.')}
    </p>
  );
}
