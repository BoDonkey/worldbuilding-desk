import {z} from 'zod';

/**
 * Reads character cards in the public Tavern Character Card format (Slice
 * 4.69): V3 (`chara_card_v3`), V2 (`chara_card_v2`), and the flat V1 shape,
 * from a JSON file or a PNG whose `ccv3` or `chara` text chunk holds the card
 * as base64 JSON. SillyTavern writes both chunks (checked on its bundled
 * default card); V3 wins when both are present. Only the format is borrowed,
 * never SillyTavern code. Everything here is pure: nothing is saved.
 */

export const MAX_CARD_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_CARD_JSON_CHARS = 2_000_000;
export const MAX_CARD_FIELD_CHARS = 50_000;
export const MAX_CARD_NAME_CHARS = 200;
export const MAX_LOREBOOK_ENTRIES = 200;
export const MAX_LOREBOOK_ENTRY_CHARS = 20_000;

export class CharacterCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterCardError';
  }
}

export interface CharacterCardLorebookEntry {
  /** The entry's own name or comment, when it has one. */
  name: string;
  keys: string[];
  content: string;
  enabled: boolean;
}

export interface CharacterCard {
  spec: 'v1' | 'v2' | 'v3';
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleDialogue: string;
  alternateGreetings: string[];
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  tags: string[];
  creator: string;
  characterVersion: string;
  lorebook: {name: string; entries: CharacterCardLorebookEntry[]} | null;
}

// Card libraries often write null for an empty field; that is read as empty, not as a bad card.
const text = z.string().max(MAX_CARD_FIELD_CHARS).nullish().transform((value) => value ?? '');
const shortText = z.string().max(MAX_CARD_NAME_CHARS).nullish().transform((value) => value ?? '');
const textList = z.array(z.string().max(MAX_CARD_FIELD_CHARS)).max(500).nullish().transform((value) => value ?? []);

const lorebookEntrySchema = z.object({
  keys: z.array(z.string().max(MAX_CARD_NAME_CHARS)).max(200).nullish().transform((value) => value ?? []),
  content: z.string().max(MAX_LOREBOOK_ENTRY_CHARS).nullish().transform((value) => value ?? ''),
  name: shortText,
  comment: z.string().max(MAX_LOREBOOK_ENTRY_CHARS).nullish().transform((value) => value ?? ''),
  enabled: z.boolean().nullish()
});

const lorebookSchema = z.object({
  name: shortText,
  entries: z.array(lorebookEntrySchema).max(MAX_LOREBOOK_ENTRIES)
});

const cardDataSchema = z.object({
  name: z.string().max(MAX_CARD_NAME_CHARS),
  nickname: text,
  description: text,
  personality: text,
  scenario: text,
  first_mes: text,
  mes_example: text,
  alternate_greetings: textList,
  creator_notes: text,
  system_prompt: text,
  post_history_instructions: text,
  tags: z.array(z.string().max(MAX_CARD_NAME_CHARS)).max(200).nullish().transform((value) => value ?? []),
  creator: shortText,
  character_version: shortText,
  character_book: lorebookSchema.nullable().optional()
});

/** A field's display label, for reasons that name what was wrong. */
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  description: 'description',
  personality: 'personality',
  scenario: 'scenario',
  first_mes: 'first message',
  mes_example: 'example dialogue',
  alternate_greetings: 'alternate greetings',
  creator_notes: 'creator notes',
  system_prompt: 'system prompt',
  post_history_instructions: 'post-history instructions',
  character_book: 'lorebook'
};

function describeSchemaIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = FIELD_LABELS[String(issue?.path[0] ?? '')] ?? String(issue?.path[0] ?? 'card');
  if (issue?.code === 'too_big') {
    if (issue.path[0] === 'character_book') {
      return `Its lorebook is too large to import (at most ${MAX_LOREBOOK_ENTRIES} entries of ${MAX_LOREBOOK_ENTRY_CHARS.toLocaleString('en-US')} characters).`;
    }
    return `Its ${field} is too long to import (at most ${(field === 'name' ? MAX_CARD_NAME_CHARS : MAX_CARD_FIELD_CHARS).toLocaleString('en-US')} characters).`;
  }
  return `Its ${field} is not in the character card format.`;
}

/** Normalizes a parsed card object of any supported version. */
export function parseCharacterCard(value: unknown): CharacterCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CharacterCardError('This file does not contain a character card.');
  }
  const record = value as Record<string, unknown>;
  const spec = record.spec;
  let version: CharacterCard['spec'];
  let data: unknown;
  if (spec === 'chara_card_v3' || spec === 'chara_card_v2') {
    version = spec === 'chara_card_v3' ? 'v3' : 'v2';
    data = record.data;
    if (!data || typeof data !== 'object') {
      throw new CharacterCardError('This character card has no character data.');
    }
  } else if (typeof spec === 'string') {
    throw new CharacterCardError(`This card uses a format SagaSpine cannot read ("${spec.slice(0, 40)}").`);
  } else if (typeof record.name === 'string' && ('description' in record || 'first_mes' in record || 'personality' in record)) {
    version = 'v1';
    data = record;
  } else {
    throw new CharacterCardError('This file does not contain a character card.');
  }

  const rawName = (data as {name?: unknown}).name;
  if (rawName === undefined || rawName === null || (typeof rawName === 'string' && !rawName.trim())) {
    throw new CharacterCardError('This character card has no name.');
  }
  const parsed = cardDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new CharacterCardError(`This character card cannot be imported. ${describeSchemaIssue(parsed.error)}`);
  }
  const card = parsed.data;
  const name = card.name.trim();
  if (!name) throw new CharacterCardError('This character card has no name.');

  const entries = (card.character_book?.entries ?? []).flatMap((entry): CharacterCardLorebookEntry[] => {
    const content = entry.content.trim();
    if (!content) return [];
    return [
      {
        name: (entry.name || entry.comment).trim().slice(0, MAX_CARD_NAME_CHARS),
        keys: entry.keys.map((key) => key.trim()).filter(Boolean),
        content,
        enabled: entry.enabled !== false
      }
    ];
  });

  return {
    spec: version,
    name,
    nickname: card.nickname.trim(),
    description: card.description.trim(),
    personality: card.personality.trim(),
    scenario: card.scenario.trim(),
    firstMessage: card.first_mes.trim(),
    exampleDialogue: card.mes_example.trim(),
    alternateGreetings: card.alternate_greetings.map((greeting) => greeting.trim()).filter(Boolean),
    creatorNotes: card.creator_notes.trim(),
    systemPrompt: card.system_prompt.trim(),
    postHistoryInstructions: card.post_history_instructions.trim(),
    tags: card.tags.map((tag) => tag.trim()).filter(Boolean),
    creator: card.creator.trim(),
    characterVersion: card.character_version.trim(),
    lorebook:
      entries.length > 0 ? {name: card.character_book?.name.trim() ?? '', entries} : null
  };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new CharacterCardError('This PNG stores its card compressed, which this app cannot read here.');
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

/** The card text chunks of a PNG, by keyword (`ccv3`, `chara`), as stored. */
export async function readPngCardChunks(bytes: Uint8Array): Promise<Map<string, string>> {
  if (!isPng(bytes)) throw new CharacterCardError('This file is not a PNG image.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = new Map<string, string>();
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = latin1(bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new CharacterCardError('This PNG image is damaged or incomplete.');
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      const data = bytes.subarray(start, end);
      const separator = data.indexOf(0);
      const keyword = separator > 0 ? latin1(data.subarray(0, separator)).toLowerCase() : '';
      if ((keyword === 'ccv3' || keyword === 'chara') && !chunks.has(keyword)) {
        const rest = data.subarray(separator + 1);
        if (type === 'tEXt') {
          chunks.set(keyword, latin1(rest));
        } else if (type === 'zTXt') {
          chunks.set(keyword, latin1(await inflate(rest.subarray(1))));
        } else {
          // iTXt: compression flag, method, language tag \0, translated keyword \0, UTF-8 text.
          const compressed = rest[0] === 1;
          const languageEnd = rest.indexOf(0, 2);
          const translatedEnd = languageEnd < 0 ? -1 : rest.indexOf(0, languageEnd + 1);
          if (translatedEnd < 0) throw new CharacterCardError('This PNG image is damaged or incomplete.');
          const body = rest.subarray(translatedEnd + 1);
          chunks.set(keyword, new TextDecoder().decode(compressed ? await inflate(body) : body));
        }
      }
    }
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
    offset = end + 4;
  }
  // A card chunk found before the cut is still usable; otherwise say the file is damaged.
  if (!sawEnd && chunks.size === 0) throw new CharacterCardError('This PNG image is damaged or incomplete.');
  return chunks;
}

function decodeChunkText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) return trimmed;
  try {
    const binary = atob(trimmed);
    return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    throw new CharacterCardError('The character data in this PNG is damaged and cannot be read.');
  }
}

function parseCardJson(textValue: string): unknown {
  if (textValue.length > MAX_CARD_JSON_CHARS) {
    throw new CharacterCardError('This character card is too large to import.');
  }
  try {
    return JSON.parse(textValue.replace(/^\uFEFF/, ''));
  } catch {
    throw new CharacterCardError('This file is not valid JSON, so no character card could be read.');
  }
}

/** Reads a card from a dropped or chosen file's bytes. */
export async function readCharacterCardFile(bytes: Uint8Array): Promise<CharacterCard> {
  if (bytes.length === 0) throw new CharacterCardError('This file is empty.');
  if (bytes.length > MAX_CARD_FILE_BYTES) {
    throw new CharacterCardError(`This file is larger than ${MAX_CARD_FILE_BYTES / 1024 / 1024} MB, so it was not read.`);
  }
  if (isPng(bytes)) {
    const chunks = await readPngCardChunks(bytes);
    const stored = chunks.get('ccv3') ?? chunks.get('chara');
    if (stored === undefined) {
      throw new CharacterCardError('This PNG image has no character card inside it.');
    }
    return parseCharacterCard(parseCardJson(decodeChunkText(stored)));
  }
  let textValue: string;
  try {
    textValue = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    throw new CharacterCardError('Choose a character card saved as PNG or JSON.');
  }
  if (!textValue.trim().startsWith('{')) {
    throw new CharacterCardError('Choose a character card saved as PNG or JSON.');
  }
  return parseCharacterCard(parseCardJson(textValue));
}
