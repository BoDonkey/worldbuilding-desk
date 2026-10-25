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
  /**
   * Other versions of the reply (Slice 4.73), present only while the author is
   * choosing. `reply` and `stopped` always mirror the version shown. Sending
   * the next message keeps the shown version and drops the rest.
   */
  versions?: {reply: string; stopped: boolean}[];
  versionIndex?: number;
}

/** At most this many versions of one reply. */
export const MAX_REPLY_VERSIONS = 5;

export const exchangeVersionCount = (exchange: CharacterLabExchange): number => exchange.versions?.length ?? 1;

/** Starts an empty new version and shows it. */
export function startExchangeVersion(exchange: CharacterLabExchange): CharacterLabExchange {
  const versions = [...(exchange.versions ?? [{reply: exchange.reply, stopped: exchange.stopped}]), {reply: '', stopped: false}];
  return {...exchange, versions, versionIndex: versions.length - 1, reply: '', stopped: false};
}

/** Updates the version shown. */
export function updateShownVersion(
  exchange: CharacterLabExchange,
  changes: Partial<Pick<CharacterLabExchange, 'reply' | 'stopped'>>
): CharacterLabExchange {
  const next = {...exchange, ...changes};
  if (!exchange.versions || exchange.versionIndex === undefined) return next;
  const versions = exchange.versions.map((version, index) =>
    index === exchange.versionIndex ? {reply: next.reply, stopped: next.stopped} : version
  );
  return {...next, versions};
}

/** Shows another version; out-of-range indexes are ignored. */
export function showExchangeVersion(exchange: CharacterLabExchange, index: number): CharacterLabExchange {
  const version = exchange.versions?.[index];
  return version ? {...exchange, versionIndex: index, reply: version.reply, stopped: version.stopped} : exchange;
}

/** Drops the version shown (a failed generation), going back to the one before it. */
export function dropShownVersion(exchange: CharacterLabExchange): CharacterLabExchange {
  if (!exchange.versions || exchange.versionIndex === undefined) return exchange;
  const versions = exchange.versions.filter((_, index) => index !== exchange.versionIndex);
  const kept = showExchangeVersion({...exchange, versions}, Math.max(0, exchange.versionIndex - 1));
  return versions.length > 1 ? kept : keepShownVersion(kept);
}

/** Keeps the version shown and discards the others. */
export function keepShownVersion(exchange: CharacterLabExchange): CharacterLabExchange {
  if (!exchange.versions) return exchange;
  const kept = {...exchange};
  delete kept.versions;
  delete kept.versionIndex;
  return kept;
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

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Plain text as escaped `<p>` blocks, one per non-empty line; `lead` is trusted HTML for the first. */
export const paragraphs = (text: string, lead?: string): string => {
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
