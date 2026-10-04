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
import {convertPlainTextToRichHtml} from '../worldBible/worldBibleEntityHelpers';

export const CHARACTER_PROFILE_FACT_TYPES = [
  'alias',
  'age',
  'occupation',
  'membership',
  'heritage',
  'identity',
  'appearance',
  'trait',
  'ability',
  'relationship',
  'goal',
  'background'
] as const satisfies readonly CanonicalFactType[];

const MAX_STABLE_FACTS = 16;
const MAX_SUGGESTED_DETAILS = 14;

/** Confidence recorded on lab fact proposals: model-proposed, quote-checked, not yet reviewed. */
export const CHARACTER_PROFILE_FACT_CONFIDENCE = 0.6;
/** Read from the description by code, not the model: an exact pattern match. */
export const CHARACTER_PROFILE_AUTO_FACT_CONFIDENCE = 0.9;
/** The model said it was unsure which fact type fits; the review shows the lower figure. */
export const CHARACTER_PROFILE_UNSURE_FACT_CONFIDENCE = 0.4;

/**
 * Near-miss fact types models commonly use for gender and pronouns. Mapped
 * before validation so one off-list label does not reject the whole reply;
 * any other unknown type still does.
 */
const FACT_TYPE_SYNONYMS: Readonly<Record<string, (typeof CHARACTER_PROFILE_FACT_TYPES)[number]>> = {
  gender: 'identity',
  pronoun: 'identity',
  pronouns: 'identity',
  sex: 'identity'
};

export function normalizeProfileFactType(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  return FACT_TYPE_SYNONYMS[key] ?? key;
}

const replySchema = z.object({
  name: z.string().max(120).nullable().optional(),
  stableFacts: z
    .array(
      z.object({
        factType: z.preprocess(normalizeProfileFactType, z.enum(CHARACTER_PROFILE_FACT_TYPES)),
        value: z.string().max(240),
        quote: z.string().max(600),
        typeUnsure: z.boolean().optional()
      })
    )
    .max(MAX_STABLE_FACTS),
  // Extra suggestions are dropped, not a reason to reject the whole reply.
  suggestedDetails: z.array(z.string().max(800)).transform((details) => details.slice(0, MAX_SUGGESTED_DETAILS))
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
  /** `auto`: read from the description by code; `model`: proposed by the model. */
  source: 'auto' | 'model';
  /** The model was unsure which fact type fits; shown for the author to check. */
  typeUnsure?: boolean;
}

const AGE_PATTERNS = [
  /\b(\d{1,3})[\s-]*(?:years?|yrs?)[\s-]*old\b/i,
  /\bage[d]?\s*:?\s*(\d{1,3})\b/i
];
const PRONOUN_PATTERN = /\b(?:pronouns?\s*:?\s*)?((?:she|he|they|xe|ze|it)\s*\/\s*(?:her|hers|him|his|them|theirs|they|xem|zir|its)(?:\s*\/\s*[a-z]+)?)\b/i;

/**
 * Facts code can read from the description without a model: an age stated as
 * "N years old", "aged N", or "age: N", and pronouns written in slash form
 * ("she/her", "pronouns: they/them"). Only the first of each; each keeps the
 * exact description span as its evidence.
 */
export function extractDeterministicProfileFacts(description: string): CharacterProfileFact[] {
  const facts: CharacterProfileFact[] = [];
  for (const pattern of AGE_PATTERNS) {
    const match = pattern.exec(description);
    if (!match) continue;
    facts.push({
      factType: 'age',
      value: match[1],
      evidence: {start: match.index, end: match.index + match[0].length, text: match[0]},
      source: 'auto'
    });
    break;
  }
  const pronouns = PRONOUN_PATTERN.exec(description);
  if (pronouns) {
    facts.push({
      factType: 'identity',
      value: pronouns[1].replace(/\s+/g, '').toLowerCase(),
      evidence: {start: pronouns.index, end: pronouns.index + pronouns[0].length, text: pronouns[0]},
      source: 'auto'
    });
  }
  return facts;
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
    stableFacts.push({
      factType: fact.factType,
      value,
      evidence,
      source: 'model',
      ...(fact.typeUnsure ? {typeUnsure: true} : {})
    });
  });

  // Code-read facts win: an age stated in the description replaces any model
  // age, and an identical model fact is not repeated.
  const autoFacts = extractDeterministicProfileFacts(description);
  const autoKeys = new Set(autoFacts.map((fact) => `${fact.factType}:${fact.value.toLocaleLowerCase()}`));
  const hasAutoAge = autoFacts.some((fact) => fact.factType === 'age');
  const modelFacts = stableFacts.filter(
    (fact) =>
      !autoKeys.has(`${fact.factType}:${fact.value.toLocaleLowerCase()}`) &&
      !(hasAutoAge && fact.factType === 'age')
  );

  const suggestedDetails = Array.from(
    new Set(result.data.suggestedDetails.map((detail) => detail.trim()).filter(Boolean))
  );

  return {
    name,
    stableFacts: [...autoFacts, ...modelFacts],
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
 * character (new target only) whose Description field holds the author's own
 * description and whose Notes hold the suggestions the author kept; a Source Note holding the author's description
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

  const details = params.suggestedDetails.map((detail) => detail.trim()).filter(Boolean);
  const entity: WorldEntity | null =
    params.target.kind === 'new'
      ? {
          id: createId(),
          projectId: params.projectId,
          categoryId: params.target.categoryId,
          name,
          fields: {
            description: convertPlainTextToRichHtml(description),
            // Each kept suggestion is its own paragraph; the author chose and may have edited them.
            ...(details.length > 0 ? {notes: convertPlainTextToRichHtml(details.join('\n\n'))} : {})
          },
          links: [],
          isNew: true,
          needsCompletion: true,
          createdAt: now,
          updatedAt: now
        }
      : null;
  const targetId = entity?.id ?? (params.target.kind === 'existing' ? params.target.entityId : '');

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
    confidence:
      fact.source === 'auto'
        ? CHARACTER_PROFILE_AUTO_FACT_CONFIDENCE
        : fact.typeUnsure
          ? CHARACTER_PROFILE_UNSURE_FACT_CONFIDENCE
          : CHARACTER_PROFILE_FACT_CONFIDENCE,
    evidence: {...fact.evidence},
    status: 'proposed',
    createdAt: now,
    updatedAt: now
  }));

  return {entity, note, link, proposals};
}
