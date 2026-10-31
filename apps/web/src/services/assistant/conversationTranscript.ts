import {stripAssistantThinking} from './assistantThinking';

/*
 * One assistant reply with the question it answered (Slice 5.17), for the
 * reading view and for saving or copying advice with its context. The reply
 * is the version the author was shown; other versions are never included.
 */

type TranscriptMessage = {role: 'user' | 'assistant' | 'system'; content: string};

export interface ReplyTurn {
  /** Index of the reply in the conversation, or null while it is still being written. */
  replyIndex: number | null;
  question: string | null;
  reply: string;
}

/** The reading view's selection: a reply by index, or the newest turn while following along. */
export type ReplyReaderSelection = number | 'latest' | null;

const lastIndexWhere = (
  messages: ReadonlyArray<TranscriptMessage>,
  before: number,
  test: (message: TranscriptMessage) => boolean
) => {
  for (let index = before - 1; index >= 0; index -= 1) {
    if (test(messages[index]!)) return index;
  }
  return -1;
};

/** The reply at `replyIndex` and the author question before it. */
export function getReplyTurn(messages: ReadonlyArray<TranscriptMessage>, replyIndex: number): ReplyTurn | null {
  const message = messages[replyIndex];
  if (message?.role !== 'assistant') return null;
  const questionIndex = lastIndexWhere(messages, replyIndex, (candidate) => candidate.role === 'user');
  const question = questionIndex >= 0 ? messages[questionIndex]!.content.trim() || null : null;
  return {replyIndex, question, reply: stripAssistantThinking(message.content).trim()};
}

/** The newest question and its reply; the reply is empty while it is still being written. */
export function getLatestTurn(messages: ReadonlyArray<TranscriptMessage>): ReplyTurn | null {
  const questionIndex = lastIndexWhere(messages, messages.length, (message) => message.role === 'user');
  const replyIndex = messages.findIndex((message, index) => index > questionIndex && message.role === 'assistant');
  if (replyIndex >= 0) return getReplyTurn(messages, replyIndex);
  if (questionIndex < 0) return null;
  return {replyIndex: null, question: messages[questionIndex]!.content.trim() || null, reply: ''};
}

export function getReaderTurn(
  messages: ReadonlyArray<TranscriptMessage>,
  selection: ReplyReaderSelection
): ReplyTurn | null {
  if (selection === null) return null;
  return selection === 'latest' ? getLatestTurn(messages) : getReplyTurn(messages, selection);
}

/** Question and reply as plain text the author reviews before it is saved or copied. */
export function formatReplyTranscript(turn: Pick<ReplyTurn, 'question' | 'reply'>): string {
  return turn.question ? `Question: ${turn.question}\n\nAnswer:\n${turn.reply}` : turn.reply;
}

/** The transcript of the newest reply, or null when there is no reply to save. */
export function buildLatestReplyTranscript(messages: ReadonlyArray<TranscriptMessage>): string | null {
  const replyIndex = lastIndexWhere(messages, messages.length, (message) => message.role === 'assistant');
  const turn = replyIndex >= 0 ? getReplyTurn(messages, replyIndex) : null;
  return turn?.reply ? formatReplyTranscript(turn) : null;
}
