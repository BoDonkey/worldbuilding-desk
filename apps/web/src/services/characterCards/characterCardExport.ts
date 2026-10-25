import type {CanonicalFact, EntityCategory, WorldEntity} from '../../entityTypes';

/**
 * Writes one World Bible character as a Tavern Character Card V2 (Slice 4.70),
 * the format SillyTavern reads. Only the character's own record goes in: its
 * fields, aliases, and accepted canon facts as the Character Lab grounds it at
 * the latest point in the manuscript. Pending proposals, Source Notes, story
 * state, and other records never do. Pure; the caller supplies what counts as
 * accepted.
 */

export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

const factText = (fact: CanonicalFact): string =>
  (typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`).trim();

const ENTITIES: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' '};

/** Rich field HTML as plain text that keeps paragraphs and list items apart. */
export function richTextToCardText(value: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(value)) return value.trim();
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const fieldText = (value: unknown): string => (typeof value === 'string' ? richTextToCardText(value) : '');

/** `Mira Voss` → `Mira_Voss.card.json`; never empty, never a path. */
export function characterCardFileName(name: string): string {
  const base = Array.from(name.normalize('NFKC'))
    .filter((char) => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
    .join('')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${base || 'character'}.card.json`;
}

export function buildCharacterCardV2(params: {
  entity: WorldEntity;
  category: EntityCategory | null;
  aliases: string[];
  /** Accepted facts that hold at the latest point, already filtered by the caller. */
  facts: CanonicalFact[];
  exportedAt: number;
}): CharacterCardV2 {
  const {entity} = params;
  const labels = new Map((params.category?.fieldSchema ?? []).map((field) => [field.key, field.label]));
  const notes = fieldText(entity.fields.notes);
  const otherFields = Object.entries(entity.fields)
    .filter(([key]) => key !== 'description' && key !== 'notes')
    .map(([key, value]) => [labels.get(key) ?? key, fieldText(value)] as const)
    .filter(([, value]) => value);

  const aliases = [...new Set(params.aliases.map((alias) => alias.trim()).filter(Boolean))].filter(
    (alias) => alias.toLocaleLowerCase() !== entity.name.trim().toLocaleLowerCase()
  );
  const traits = params.facts.filter((fact) => fact.factType === 'trait').map(factText).filter(Boolean);
  const otherFacts = params.facts
    .filter((fact) => fact.factType !== 'trait' && fact.factType !== 'alias')
    .map((fact) => `- ${fact.factType.replace(/_/g, ' ')}: ${factText(fact)}`)
    .filter((line) => !line.endsWith(': '));

  const description = [
    fieldText(entity.fields.description),
    otherFields.map(([label, value]) => `${label}: ${value}`).join('\n'),
    aliases.length > 0 ? `Also known as: ${aliases.join(', ')}` : '',
    otherFacts.length > 0 ? `Facts:\n${[...new Set(otherFacts)].join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  // The author's own calendar day, not UTC's.
  const at = new Date(params.exportedAt);
  const exportedOn = [at.getFullYear(), at.getMonth() + 1, at.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: entity.name.trim(),
      description,
      personality: [...new Set(traits)].join('; '),
      scenario: '',
      first_mes: '',
      mes_example: '',
      // Card libraries show creator notes to people, not to the chat model.
      creator_notes: [`Exported from SagaSpine on ${exportedOn}.`, notes ? `Author notes:\n${notes}` : '']
        .filter(Boolean)
        .join('\n\n'),
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: '',
      character_version: '',
      extensions: {}
    }
  };
}
