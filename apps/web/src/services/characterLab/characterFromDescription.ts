import {z} from 'zod';
import type {
  CanonicalFactType,
  Character,
  CharacterSheet,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';
import {
  createCharacterLinkResolver,
  isCharacterCategory,
  normalizeCharacterIdentityName
} from '../characters/characterIdentity';
import type {ConsistencyAlias} from '../consistency/aliasStorage';

export const CHARACTER_PROFILE_FACT_TYPES = [
  'alias',
  'age',
  'occupation',
  'membership',
  'heritage',
  'appearance',
  'trait',
  'ability',
  'relationship',
  'goal',
  'background'
] as const satisfies readonly CanonicalFactType[];

const MAX_STABLE_FACTS = 16;
const MAX_SUGGESTED_DETAILS = 10;

/** Confidence recorded on lab fact proposals: model-proposed, quote-checked, not yet reviewed. */
export const CHARACTER_PROFILE_FACT_CONFIDENCE = 0.6;

const replySchema = z.object({
  name: z.string().max(120).nullable().optional(),
  stableFacts: z
    .array(
      z.object({
        factType: z.enum(CHARACTER_PROFILE_FACT_TYPES),
        value: z.string().max(240),
        quote: z.string().max(600)
      })
    )
    .max(MAX_STABLE_FACTS),
  suggestedDetails: z.array(z.string().max(400)).max(MAX_SUGGESTED_DETAILS)
});

export class CharacterProfileReplyError extends Error {
  constructor() {
    super('The model reply was not a usable character profile. Nothing was kept; try again.');
    this.name = 'CharacterProfileReplyError';
  }
}

export interface CharacterProfileFact {
  factType: CanonicalFactType;
  value: string;
  /** Span of the author's own description that states the fact. */
  evidence: {start: number; end: number; text: string};
}

/** A model profile after deterministic validation against the author's description. */
export interface CharacterProfile {
  /** Only a name the description itself contains; otherwise null. */
  name: string | null;
  stableFacts: CharacterProfileFact[];
  suggestedDetails: string[];
  /** Facts discarded because their quote is not in the description. */
  droppedFactCount: number;
  /** True when the model offered a name the description does not contain. */
  droppedName: boolean;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where `quote` occurs in `description`, ignoring case and runs of whitespace.
 * Returns the span of the description's own text, or null.
 */
export function findQuoteSpan(
  description: string,
  quote: string
): {start: number; end: number; text: string} | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const match = new RegExp(words.map(escapeRegExp).join('\\s+'), 'i').exec(description);
  if (!match) return null;
  return {start: match.index, end: match.index + match[0].length, text: match[0]};
}

const nameAppearsIn = (name: string, description: string): boolean => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${words.map(escapeRegExp).join('\\s+')}($|[^\\p{L}\\p{N}])`, 'iu').test(
    description
  );
};

const extractJsonText = (content: string): string => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
};

/**
 * Validates a generation reply against the author's description. A malformed
 * reply is rejected whole. Facts must quote the description; a name must
 * appear in it. Nothing here is persisted.
 */
export function parseCharacterProfileReply(content: string, description: string): CharacterProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch {
    throw new CharacterProfileReplyError();
  }
  const result = replySchema.safeParse(parsed);
  if (!result.success) throw new CharacterProfileReplyError();

  const offeredName = result.data.name?.trim() || null;
  const name = offeredName && nameAppearsIn(offeredName, description) ? offeredName : null;

  const seen = new Set<string>();
  const stableFacts: CharacterProfileFact[] = [];
  let droppedFactCount = 0;
  result.data.stableFacts.forEach((fact) => {
    const value = fact.value.trim();
    const evidence = value ? findQuoteSpan(description, fact.quote) : null;
    if (!evidence) {
      droppedFactCount += 1;
      return;
    }
    const key = `${fact.factType}:${value.toLocaleLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    stableFacts.push({factType: fact.factType, value, evidence});
  });

  const suggestedDetails = Array.from(
    new Set(result.data.suggestedDetails.map((detail) => detail.trim()).filter(Boolean))
  );

  return {
    name,
    stableFacts,
    suggestedDetails,
    droppedFactCount,
    droppedName: Boolean(offeredName) && !name
  };
}

export interface CharacterNameCollision {
  entityId: string;
  name: string;
  /** The matched surface: the record's canonical name or one of its aliases. */
  via: 'name' | 'alias';
  matchedText: string;
}

/**
 * Existing character records the proposed name already refers to, by exact
 * normalized canonical name or alias. The author decides what a match means;
 * nothing is merged here.
 */
export function findCharacterNameCollisions(params: {
  name: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  aliases: ConsistencyAlias[];
}): CharacterNameCollision[] {
  const wanted = normalizeCharacterIdentityName(params.name);
  if (!wanted) return [];
  const characterCategoryIds = new Set(
    params.categories.filter((category) => isCharacterCategory(category)).map((category) => category.id)
  );
  const resolver = createCharacterLinkResolver({
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.sheets
  });
  const collisions = new Map<string, CharacterNameCollision>();
  params.entities.forEach((entity) => {
    if (!characterCategoryIds.has(entity.categoryId)) return;
    if (normalizeCharacterIdentityName(entity.name) === wanted) {
      collisions.set(entity.id, {entityId: entity.id, name: entity.name, via: 'name', matchedText: entity.name});
    }
  });
  params.aliases.forEach((alias) => {
    if (normalizeCharacterIdentityName(alias.alias) !== wanted) return;
    const entityId =
      (alias.targetType ?? 'entity') === 'entity'
        ? resolver.getEntity(alias.targetId)?.id
        : resolver.resolveEntityId({characterId: alias.targetId});
    const entity = entityId ? resolver.getEntity(entityId) : undefined;
    if (!entity || collisions.has(entity.id)) return;
    collisions.set(entity.id, {entityId: entity.id, name: entity.name, via: 'alias', matchedText: alias.alias});
  });
  return [...collisions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type CharacterFromDescriptionTarget =
  | {kind: 'new'; categoryId: string; name: string}
  | {kind: 'existing'; entityId: string; name: string};

export interface CharacterFromDescriptionRecords {
  entity: WorldEntity | null;
  note: LoreDocument;
  link: LoreDocumentLink;
  proposals: LoreFactProposal[];
}

export const SUGGESTED_DETAILS_HEADING = 'Suggested details from the character lab (not canon):';

/**
 * Builds the records an explicit author accept creates: a draft World Bible
 * character (new target only), a Source Note holding the author's description
 * and the kept suggestions, its primary-subject link, and one proposed fact per
 * kept stable fact with evidence in that note. Nothing is canon until the
 * author accepts each fact in the normal review. Pure; nothing is saved.
 */
export function buildCharacterFromDescriptionRecords(params: {
  projectId: string;
  sessionId: string;
  description: string;
  target: CharacterFromDescriptionTarget;
  stableFacts: CharacterProfileFact[];
  suggestedDetails: string[];
  now?: number;
  createId?: () => string;
}): CharacterFromDescriptionRecords {
  const now = params.now ?? Date.now();
  const createId = params.createId ?? (() => crypto.randomUUID());
  const name = params.target.name.trim();
  if (!name) throw new Error('Give the character a name first.');
  const description = params.description;
  if (!description.trim()) throw new Error('The description is empty.');

  const entity: WorldEntity | null =
    params.target.kind === 'new'
      ? {
          id: createId(),
          projectId: params.projectId,
          categoryId: params.target.categoryId,
          name,
          fields: {},
          links: [],
          isNew: true,
          needsCompletion: true,
          createdAt: now,
          updatedAt: now
        }
      : null;
  const targetId = entity?.id ?? (params.target.kind === 'existing' ? params.target.entityId : '');

  const details = params.suggestedDetails.map((detail) => detail.trim()).filter(Boolean);
  // The description comes first and unchanged, so fact evidence offsets stay valid.
  const content =
    details.length > 0
      ? `${description}\n\n${SUGGESTED_DETAILS_HEADING}\n${details.map((detail) => `- ${detail}`).join('\n')}`
      : description;
  params.stableFacts.forEach((fact) => {
    if (content.slice(fact.evidence.start, fact.evidence.end) !== fact.evidence.text) {
      throw new Error('A fact no longer matches the description. Draft the profile again.');
    }
  });

  const note: LoreDocument = {
    id: createId(),
    projectId: params.projectId,
    title: `Character lab: ${name}`,
    kind: 'character_dossier',
    format: 'plain_text',
    content,
    summary: description.replace(/\s+/g, ' ').trim().slice(0, 220),
    source: {type: 'ai-session', sessionId: params.sessionId},
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  const link: LoreDocumentLink = {
    id: createId(),
    projectId: params.projectId,
    loreDocumentId: note.id,
    targetType: 'entity',
    targetId,
    relationship: 'primary_subject',
    createdAt: now
  };
  const proposals: LoreFactProposal[] = params.stableFacts.map((fact) => ({
    id: createId(),
    projectId: params.projectId,
    loreDocumentId: note.id,
    targetType: 'entity',
    targetId,
    targetName: name,
    factType: fact.factType,
    value: fact.value,
    confidence: CHARACTER_PROFILE_FACT_CONFIDENCE,
    evidence: {...fact.evidence},
    status: 'proposed',
    createdAt: now,
    updatedAt: now
  }));

  return {entity, note, link, proposals};
}
