import type {LoreDocument, LoreDocumentLink, WorldEntity} from '../../entityTypes';
import {convertPlainTextToRichHtml} from '../worldBible/worldBibleEntityHelpers';
import type {CharacterCard, CharacterCardLorebookEntry} from './characterCardParse';

/**
 * Turns a parsed character card into the records an explicit author confirm
 * writes (Slice 4.69): a draft World Bible character (new target only), a
 * Source Note holding the whole card, and one Source Note per kept lorebook
 * entry. Nothing is canon: the character is marked Needs completion, and the
 * notes go through the normal intake and review like any imported document.
 * Pure; nothing is saved.
 */

export type CharacterCardImportTarget =
  | {kind: 'new'; categoryId: string; name: string}
  | {kind: 'existing'; entityId: string; name: string};

export interface CharacterCardImportRecords {
  entity: WorldEntity | null;
  cardNote: LoreDocument;
  lorebookNotes: LoreDocument[];
  links: LoreDocumentLink[];
}

/**
 * Card macros: `{{char}}` (and the older `<BOT>`) is the character, so it is
 * replaced with the name. `{{user}}` is whoever chats with the character in
 * SillyTavern; it has no meaning in a manuscript, so it stays visible for the
 * author to rewrite.
 */
export function resolveCardMacros(value: string, name: string): string {
  return value.replace(/\{\{\s*char\s*\}\}|<BOT>/gi, name);
}

interface CardSection {
  label: string;
  text: string;
}

function noteSections(card: CharacterCard, name: string): CardSection[] {
  const sections: CardSection[] = [
    {label: 'Personality', text: card.personality},
    {label: 'Scenario', text: card.scenario},
    {label: 'First message', text: card.firstMessage},
    {label: 'Example dialogue', text: card.exampleDialogue},
    ...card.alternateGreetings.map((text, index) => ({label: `Alternate greeting ${index + 1}`, text})),
    {label: 'Creator notes', text: card.creatorNotes}
  ];
  return sections
    .map((section) => ({...section, text: resolveCardMacros(section.text, name).trim()}))
    .filter((section) => section.text);
}

function provenanceLine(card: CharacterCard, fileName: string): string {
  const parts = [
    `Imported from the character card ${fileName} `,
    `(${card.spec.toUpperCase()} format`,
    card.creator ? `, by ${card.creator}` : '',
    card.characterVersion ? `, version ${card.characterVersion}` : '',
    ')'
  ];
  return `${parts.join('')}.`;
}

/** The card's own fields, labeled, in the order the import preview shows them. */
export function buildCardNoteContent(card: CharacterCard, name: string, fileName: string): string {
  const sections: CardSection[] = [
    {label: 'Description', text: resolveCardMacros(card.description, name).trim()},
    ...noteSections(card, name),
    // The card's system prompt and post-history instructions are left out: they
    // are instructions to a chat model, and a Source Note can be retrieved into
    // this app's own prompts.
    {label: 'Nickname', text: card.nickname},
    {label: 'Tags', text: card.tags.join(', ')}
  ].filter((section) => section.text);
  return [provenanceLine(card, fileName), ...sections.map((section) => `${section.label}:\n${section.text}`)].join('\n\n');
}

export function lorebookEntryTitle(entry: CharacterCardLorebookEntry, index: number): string {
  return entry.name || entry.keys.slice(0, 3).join(', ') || `Entry ${index + 1}`;
}

function richNotes(sections: CardSection[]): string | undefined {
  if (sections.length === 0) return undefined;
  return convertPlainTextToRichHtml(sections.map((section) => `${section.label}:\n${section.text}`).join('\n\n'));
}

export function buildCharacterCardImportRecords(params: {
  projectId: string;
  card: CharacterCard;
  fileName: string;
  mimeType?: string;
  target: CharacterCardImportTarget;
  /** Indexes into `card.lorebook.entries` the author kept. */
  keptLorebookEntries: number[];
  now?: number;
  createId?: () => string;
}): CharacterCardImportRecords {
  const now = params.now ?? Date.now();
  const createId = params.createId ?? (() => crypto.randomUUID());
  const name = params.target.name.trim();
  if (!name) throw new Error('Give the character a name first.');
  const {card} = params;
  const source: LoreDocument['source'] = {
    type: 'import',
    fileName: params.fileName,
    ...(params.mimeType ? {mimeType: params.mimeType} : {})
  };

  const description = resolveCardMacros(card.description, name).trim();
  const notes = richNotes(noteSections(card, name));
  const entity: WorldEntity | null =
    params.target.kind === 'new'
      ? {
          id: createId(),
          projectId: params.projectId,
          categoryId: params.target.categoryId,
          name,
          fields: {
            ...(description ? {description: convertPlainTextToRichHtml(description)} : {}),
            ...(notes ? {notes} : {})
          },
          links: [],
          isNew: true,
          needsCompletion: true,
          createdAt: now,
          updatedAt: now
        }
      : null;
  const targetId = entity?.id ?? (params.target.kind === 'existing' ? params.target.entityId : '');

  const cardContent = buildCardNoteContent(card, name, params.fileName);
  const cardNote: LoreDocument = {
    id: createId(),
    projectId: params.projectId,
    title: `Character card: ${name}`,
    kind: 'character_dossier',
    format: 'plain_text',
    content: cardContent,
    summary: (description || cardContent).replace(/\s+/g, ' ').trim().slice(0, 220),
    source,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  const entries = card.lorebook?.entries ?? [];
  const kept = [...new Set(params.keptLorebookEntries)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < entries.length)
    .sort((a, b) => a - b);
  const lorebookNotes: LoreDocument[] = kept.map((index) => {
    const entry = entries[index] as CharacterCardLorebookEntry;
    const content = resolveCardMacros(entry.content, name);
    return {
      id: createId(),
      projectId: params.projectId,
      title: `${name} lorebook: ${lorebookEntryTitle(entry, index)}`,
      kind: 'general_lore',
      format: 'plain_text',
      content: entry.keys.length > 0 ? `Keys: ${entry.keys.join(', ')}\n\n${content}` : content,
      summary: content.replace(/\s+/g, ' ').trim().slice(0, 220),
      source,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
  });

  const link = (note: LoreDocument, relationship: LoreDocumentLink['relationship']): LoreDocumentLink => ({
    id: createId(),
    projectId: params.projectId,
    loreDocumentId: note.id,
    targetType: 'entity',
    targetId,
    relationship,
    createdAt: now
  });

  return {
    entity,
    cardNote,
    lorebookNotes,
    links: [link(cardNote, 'primary_subject'), ...lorebookNotes.map((note) => link(note, 'mentions'))]
  };
}
