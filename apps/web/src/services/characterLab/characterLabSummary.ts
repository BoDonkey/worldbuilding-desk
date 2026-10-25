import type {LLMMessage} from '../llm/types';
import {buildCharacterTalkTranscript, type CharacterLabExchange} from './characterLabTranscript';
import type {CharacterVoiceTurn} from './characterVoicePrompt';

/**
 * Rolling summaries for long Character Lab Talk sessions (Slice 4.74). Older
 * turns are replaced, for the model only, by a summary the author sees and
 * can edit. The summary is a working note for this session: never canon,
 * never saved to the World Bible, and it does not change the turns shown.
 */
export interface CharacterLabSummary {
  text: string;
  /** The last exchange the summary covers; later exchanges are sent in full. */
  coversThroughId: string;
  /** How many Talk exchanges it covers. */
  coveredCount: number;
  /** The author changed the model's wording. */
  edited: boolean;
}

/** The most recent Talk exchanges always go to the model word for word. */
export const SUMMARY_KEEP_RECENT = 2;
/** Offer a summary once the conversation takes this share of the model's context. */
export const SUMMARY_OFFER_SHARE = 0.35;

export const SUMMARY_LABEL = 'Summary of the earlier conversation';

const isCompleteTalk = (exchange: CharacterLabExchange) =>
  exchange.mode === 'talk' && !exchange.stopped && Boolean(exchange.reply.trim());

/** Index just past the summarized exchanges; 0 without a summary or when its exchange is gone. */
const summaryEnd = (exchanges: CharacterLabExchange[], summary: CharacterLabSummary | null): number => {
  if (!summary) return 0;
  const index = exchanges.findIndex((exchange) => exchange.id === summary.coversThroughId);
  return index === -1 ? 0 : index + 1;
};

/** Whether an exchange's turn reaches the model only through the summary. */
export function isSummarized(
  exchanges: CharacterLabExchange[],
  summary: CharacterLabSummary | null,
  exchangeId: string
): boolean {
  const index = exchanges.findIndex((exchange) => exchange.id === exchangeId);
  return index !== -1 && index < summaryEnd(exchanges, summary) && isCompleteTalk(exchanges[index]!);
}

/** Complete Talk exchanges not yet summarized, leaving the most recent ones out. */
export function summarizableExchanges(
  exchanges: CharacterLabExchange[],
  summary: CharacterLabSummary | null
): CharacterLabExchange[] {
  const unsummarized = exchanges.slice(summaryEnd(exchanges, summary)).filter(isCompleteTalk);
  return unsummarized.slice(0, Math.max(0, unsummarized.length - SUMMARY_KEEP_RECENT));
}

/** What the model gets for the conversation: the summary, if any, then the turns after it. */
export function buildSummarizedTranscript(
  exchanges: CharacterLabExchange[],
  summary: CharacterLabSummary | null
): {summary: string | null; turns: CharacterVoiceTurn[]} {
  const text = summary?.text.trim() || null;
  return {
    summary: text,
    turns: buildCharacterTalkTranscript(text ? exchanges.slice(summaryEnd(exchanges, summary)) : exchanges)
  };
}

/** Offer a summary when the conversation fills enough of the context and there is something to summarize. */
export function shouldOfferSummary(params: {
  conversationTokens: number;
  contextTokens: number | null;
  summarizable: number;
}): boolean {
  return (
    params.summarizable > 0 &&
    params.contextTokens !== null &&
    params.conversationTokens >= params.contextTokens * SUMMARY_OFFER_SHARE
  );
}

/** The request that writes (or extends) the summary. Only the conversation is sent, never other records. */
export function buildSummaryRequest(params: {
  characterName: string;
  previousSummary: string | null;
  exchanges: CharacterLabExchange[];
}): {systemPrompt: string; messages: LLMMessage[]} {
  if (params.exchanges.length === 0) throw new Error('There are no earlier turns to summarize.');
  const name = params.characterName;
  const turns = params.exchanges
    .map((exchange) => `Author: ${exchange.prompt.trim()}\n${name}: ${exchange.reply.trim()}`)
    .join('\n\n');
  return {
    systemPrompt: [
      `You summarize part of a conversation between an author and ${name}, a character in their ` +
        'story, so the conversation can continue in less space.',
      'Keep what the character said about themselves and others, anything promised or decided, ' +
        'questions left open, and the tone between them. Write in the third person, past tense, ' +
        'in at most 200 words. Do not add anything that was not said. Reply with the summary only.',
      'The summary is a working note for this session. It is not canon and does not change the story.'
    ].join('\n\n'),
    messages: [
      {
        role: 'user',
        content: [
          params.previousSummary?.trim()
            ? `Summary so far (extend it with the turns below):\n${params.previousSummary.trim()}`
            : null,
          `Turns to summarize:\n\n${turns}`
        ]
          .filter(Boolean)
          .join('\n\n')
      }
    ]
  };
}
