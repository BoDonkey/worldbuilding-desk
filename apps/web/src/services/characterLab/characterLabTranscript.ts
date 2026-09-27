import type {CharacterVoiceTurn} from './characterVoicePrompt';

export type CharacterLabMode = 'talk' | 'reaction';

/** One author request and the character's reply in a lab session. Lives only for the session. */
export interface CharacterLabExchange {
  id: string;
  mode: CharacterLabMode;
  prompt: string;
  reply: string;
  positionLabel: string;
  /** The author pressed Stop, so `reply` is whatever arrived before that. */
  stopped: boolean;
}

/**
 * Earlier Talk turns to send with the next message, oldest first. Reaction tests are
 * independent questions, and stopped or empty replies are incomplete, so neither is replayed.
 */
export function buildCharacterTalkTranscript(exchanges: CharacterLabExchange[]): CharacterVoiceTurn[] {
  return exchanges
    .filter((exchange) => exchange.mode === 'talk' && !exchange.stopped && exchange.reply.trim())
    .flatMap((exchange) => [
      {speaker: 'author' as const, text: exchange.prompt},
      {speaker: 'character' as const, text: exchange.reply}
    ]);
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const paragraphs = (text: string, lead?: string): string => {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return lead ? `<p>${lead}</p>` : '';
  return lines
    .map((line, index) => `<p>${index === 0 && lead ? `${lead} ` : ''}${escapeHtml(line)}</p>`)
    .join('');
};

/** Scratchpad HTML for a lab session, marked as draft material rather than canon. */
export function formatCharacterLabScratchpadHtml(params: {
  characterName: string;
  exchanges: CharacterLabExchange[];
}): string {
  const name = escapeHtml(params.characterName);
  const parts = [
    `<h3>Character lab: ${name}</h3>`,
    '<p><em>Draft from the character lab. Not canon.</em></p>'
  ];
  let positionLabel: string | null = null;
  params.exchanges.forEach((exchange) => {
    if (exchange.positionLabel !== positionLabel) {
      positionLabel = exchange.positionLabel;
      parts.push(`<p><em>Story state at ${escapeHtml(positionLabel)}</em></p>`);
    }
    const stoppedNote = exchange.stopped ? '<p><em>(Stopped before the reply finished.)</em></p>' : '';
    if (exchange.mode === 'talk') {
      parts.push(paragraphs(exchange.prompt, '<strong>You:</strong>'));
      parts.push(paragraphs(exchange.reply, `<strong>${name}:</strong>`) + stoppedNote);
    } else {
      parts.push(paragraphs(exchange.prompt, '<strong>Reaction test:</strong>'));
      parts.push(paragraphs(exchange.reply) + stoppedNote);
    }
  });
  return parts.join('');
}
