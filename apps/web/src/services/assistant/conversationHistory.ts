import type {LLMMessage} from '../llm/types';
import {estimateTextTokens} from '../llm/contextBudget';
import {keepShownReply, type VersionedReply} from './replyVersions';
import {stripAssistantThinking} from './assistantThinking';

/*
 * Earlier turns sent with an assistant follow-up (Slice 5.17), so an answer to
 * "which option?" reaches the model together with the question and the options
 * it offered. Only the reply version the author was shown is sent; discarded
 * alternatives never are. Whole turns are kept newest first within a budget;
 * the most recent turn is always sent, its reply shortened from the start if
 * it alone is too long, because a reply's options usually come at its end.
 */

type HistoryMessage = VersionedReply & {role: LLMMessage['role']};

export const DEFAULT_HISTORY_TOKENS = 3_000;
const MIN_HISTORY_TOKENS = 512;
const MAX_HISTORY_TOKENS = 6_000;
const HISTORY_CONTEXT_SHARE = 0.25;
const OMITTED_MARKER = '[Earlier part of this reply omitted.]\n';

/** Room for earlier turns: a quarter of the model's context, within fixed bounds. */
export function assistantHistoryBudget(contextTokens: number | null): number {
  if (contextTokens === null) return DEFAULT_HISTORY_TOKENS;
  const share = Math.floor(contextTokens * HISTORY_CONTEXT_SHARE);
  return Math.min(MAX_HISTORY_TOKENS, Math.max(MIN_HISTORY_TOKENS, share));
}

const turnTokens = (turn: LLMMessage[]): number =>
  turn.reduce((sum, message) => sum + estimateTextTokens(message.content) + 8, 0);

/** Keeps the end of `text` within `tokens`, marking what was cut. */
function keepEnd(text: string, tokens: number): string {
  const room = Math.max(0, tokens - estimateTextTokens(OMITTED_MARKER));
  const characters = [...text];
  let start = characters.length;
  let used = 0;
  while (start > 0) {
    const next = estimateTextTokens(characters[start - 1]!);
    if (used + next > room) break;
    used += next;
    start -= 1;
  }
  return start === 0 ? text : `${OMITTED_MARKER}${characters.slice(start).join('').trimStart()}`;
}

/** Completed question/answer pairs, oldest first, as the author saw them. */
function completedTurns(messages: ReadonlyArray<HistoryMessage>): LLMMessage[][] {
  const turns: LLMMessage[][] = [];
  let question: string | null = null;
  for (const message of messages) {
    if (message.role === 'user') {
      question = message.content.trim() || null;
      continue;
    }
    if (message.role !== 'assistant' || question === null) continue;
    const answer = stripAssistantThinking(keepShownReply(message).content).trim();
    if (answer) {
      turns.push([
        {role: 'user', content: question},
        {role: 'assistant', content: answer}
      ]);
    }
    question = null;
  }
  return turns;
}

export function buildAssistantHistory(
  messages: ReadonlyArray<HistoryMessage>,
  budgetTokens: number
): {messages: LLMMessage[]; omittedTurns: number} {
  const turns = completedTurns(messages);
  const kept: LLMMessage[][] = [];
  let used = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]!;
    const tokens = turnTokens(turn);
    if (used + tokens <= budgetTokens) {
      kept.unshift(turn);
      used += tokens;
      continue;
    }
    if (kept.length === 0) {
      const [question, answer] = turn as [LLMMessage, LLMMessage];
      const room = budgetTokens - turnTokens([question]) - 8;
      kept.unshift([question, {role: 'assistant', content: keepEnd(answer.content, room)}]);
    }
    break;
  }
  return {messages: kept.flat(), omittedTurns: turns.length - kept.length};
}
