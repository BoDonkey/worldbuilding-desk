import type {CanonicalFact, WritingDocument} from '../../entityTypes';
import {htmlToPlainText} from '../../utils/textHelpers';
import type {KnownEntityRef} from './types';

/**
 * Fact-anchored canon comparison (roadmap slice 4.24).
 *
 * The engine carries no fictional attribute rules. Which attributes matter
 * comes only from the author's accepted facts: each fact's value is parsed
 * into a *slot* (a head noun plus the modifier occupying it, or a number),
 * and scene text attributed to the fact's entity is searched for the same
 * noun with a *comparable* modifier. Comparable means explicitly related
 * in a way the engine can defend: an explicit negation of the accepted
 * value, a different number, or a member of the same value class. Value
 * classes are either linguistic (colors, numbers — true of English, not of
 * any story) or learned from the author's own canon (every other accepted
 * value with the same fact type and head noun). Adjectives outside any
 * class never fire, so "tired eyes" does not contradict "gray eyes".
 */

export interface CanonSlotAssertion {
  entityId: string;
  factId: string;
  factType: CanonicalFact['factType'];
  /** Singular stem of the head noun, or `null` for a bare numeric value such as an age. */
  headNoun: string | null;
  /** Normalized modifier occupying the slot (e.g. "gray"), or `null` for numeric-only. */
  modifier: string | null;
  numeric: number | null;
  /** Author-facing rendering of the canon value. */
  phrase: string;
  sourceTitle: string;
  sourceDetail: string;
}

export interface SceneSlotClaim {
  entityId: string;
  sceneId: string;
  sceneTitle: string;
  headNoun: string | null;
  modifier: string | null;
  numeric: number | null;
  negated: boolean;
  /** Scene span shown to the author (focus text). */
  phrase: string;
}

export interface SlotConflict {
  canon: CanonSlotAssertion;
  scene: SceneSlotClaim;
  reason: 'negation' | 'number' | 'value-class';
}

export interface SlotComparisonOptions {
  /** Per-project synonym pairs, applied after the built-in table (e.g. [['ash-blond', 'blond']]). */
  synonyms?: Array<[string, string]>;
}

// --- Linguistic value classes ---------------------------------------------

/** Basic color terms: a property of English, not of any fictional world. */
export const COLOR_CLASS = new Set([
  'amber', 'auburn', 'azure', 'black', 'blond', 'blue', 'bronze', 'brown', 'chestnut',
  'copper', 'crimson', 'ebony', 'emerald', 'ginger', 'gold', 'golden', 'gray', 'green',
  'hazel', 'indigo', 'ivory', 'jade', 'lavender', 'olive', 'orange', 'pink', 'purple',
  'red', 'ruby', 'russet', 'sapphire', 'scarlet', 'silver', 'tawny', 'teal', 'violet',
  'white', 'yellow'
]);

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000
};

const BUILT_IN_SYNONYMS: Array<[string, string]> = [
  ['grey', 'gray'],
  ['colour', 'color'],
  ['blonde', 'blond'],
  ['golden', 'gold']
];

const SLOT_STOP_WORDS = new Set([
  'a', 'an', 'the', 'her', 'his', 'their', 'its', 'my', 'your', 'our', 'own', 'same',
  'of', 'and', 'or', 'with', 'very', 'so', 'too', 'still', 'both', 'those', 'these',
  'that', 'this', 'some', 'like', 'as', 'in', 'on', 'at', 'to'
]);

const NEGATION_PATTERN = /\b(?:not|never|no longer|isn't|wasn't|aren't|weren't|ain't)\b/iu;

export function parseNumber(token: string): number | null {
  const cleaned = token.toLowerCase().replace(/,/g, '');
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  const parts = cleaned.split(/[-\s]+/).filter(Boolean);
  if (parts.length === 0 || !parts.every((part) => part in NUMBER_WORDS)) return null;
  let total = 0;
  let current = 0;
  for (const part of parts) {
    const value = NUMBER_WORDS[part]!;
    if (value === 100 || value === 1000) {
      current = (current || 1) * value;
      total += current;
      current = 0;
    } else {
      current += value;
    }
  }
  return total + current;
}

const buildSynonymMap = (options?: SlotComparisonOptions): Map<string, string> => {
  const map = new Map<string, string>();
  [...BUILT_IN_SYNONYMS, ...(options?.synonyms ?? [])].forEach(([from, to]) => {
    map.set(from.toLowerCase().trim(), to.toLowerCase().trim());
  });
  return map;
};

export function normalizeSlotToken(token: string, synonyms: Map<string, string>): string {
  const lower = token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return synonyms.get(lower) ?? lower;
}

const stemNoun = (token: string): string => {
  const lower = token.toLowerCase();
  if (lower.length > 4 && lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && /(?:ses|xes|zes|ches|shes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
};

const nounPattern = (stem: string): RegExp =>
  new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|ies)?\\b`, 'giu');

// --- Canon side -------------------------------------------------------------

export function parseFactValue(
  fact: CanonicalFact,
  synonyms: Map<string, string>
): Pick<CanonSlotAssertion, 'headNoun' | 'modifier' | 'numeric'> | null {
  const raw = typeof fact.value === 'string' ? fact.value : fact.value.value || fact.value.label;
  const text = raw.trim().replace(/[.,!?;:]+$/g, '');
  if (!text) return null;

  const ageMatch = text.match(/^(?:aged?\s+)?([\p{L}\p{N}-]+(?:\s+[\p{L}\p{N}-]+)?)(?:\s+years?\s+old)?$/iu);
  if (ageMatch) {
    const numeric = parseNumber(ageMatch[1]!);
    if (numeric !== null) return {headNoun: null, modifier: null, numeric};
  }

  const tokens = text.split(/\s+/).filter((token) => !SLOT_STOP_WORDS.has(token.toLowerCase()));
  if (tokens.length < 2) return null;
  const headNoun = stemNoun(normalizeSlotToken(tokens[tokens.length - 1]!, synonyms));
  const modifierTokens = tokens.slice(0, -1);
  const numeric = parseNumber(modifierTokens.join(' '));
  if (numeric !== null) return {headNoun, modifier: null, numeric};
  if (modifierTokens.length !== 1) return null; // ambiguous slot; the assertion path still covers it
  return {headNoun, modifier: normalizeSlotToken(modifierTokens[0]!, synonyms), numeric: null};
}

export function buildCanonSlotAssertions(params: {
  canonicalFacts: CanonicalFact[];
  resolveEntityId: (fact: CanonicalFact) => {entityId: string; name: string} | null;
  options?: SlotComparisonOptions;
}): CanonSlotAssertion[] {
  const synonyms = buildSynonymMap(params.options);
  return params.canonicalFacts.flatMap((fact) => {
    const target = params.resolveEntityId(fact);
    if (!target) return [];
    const slot = parseFactValue(fact, synonyms);
    if (!slot) return [];
    const raw = typeof fact.value === 'string' ? fact.value : fact.value.value || fact.value.label;
    return [{
      entityId: target.entityId,
      factId: fact.id,
      factType: fact.factType,
      ...slot,
      phrase: `${target.name} has ${raw}`.trim(),
      sourceTitle: target.name,
      sourceDetail: fact.sourceLoreDocumentTitle
        ? `accepted lore fact from "${fact.sourceLoreDocumentTitle}"`
        : 'accepted lore fact'
    }];
  });
}

/** Modifiers accepted elsewhere in canon for the same fact type and head noun. */
export function learnValueClasses(assertions: CanonSlotAssertion[]): Map<string, Set<string>> {
  const classes = new Map<string, Set<string>>();
  assertions.forEach((assertion) => {
    if (!assertion.modifier || !assertion.headNoun) return;
    const key = `${assertion.factType}:${assertion.headNoun}`;
    const members = classes.get(key) ?? new Set<string>();
    members.add(assertion.modifier);
    classes.set(key, members);
  });
  return classes;
}

const isComparable = (
  accepted: string,
  candidate: string,
  learned: Set<string> | undefined
): boolean => {
  if (accepted === candidate) return false;
  if (COLOR_CLASS.has(accepted) && COLOR_CLASS.has(candidate)) return true;
  if (learned && learned.has(accepted) && learned.has(candidate)) return true;
  return false;
};

// --- Scene side -------------------------------------------------------------

export const splitReviewBlocks = (content: string): string[] =>
  content
    .split(/(?:\r?\n\s*){2,}|<\/(?:blockquote|div|h[1-6]|li|p)>\s*/iu)
    .map((block) => htmlToPlainText(block))
    .filter(Boolean);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SPEECH_VERBS =
  'said|says|asked|asks|called|calls|replied|replies|answered|answers|whispered|whispers|murmured|murmurs|muttered|mutters|shouted|shouts|added|adds|told|tells|snapped|snaps|laughed|laughs';

/** Entity ids whose names appear as a speaker tag beside a quotation in this block. */
const speakerEntityIds = (block: string, namesByEntityId: Map<string, string[]>): Set<string> => {
  const speakers = new Set<string>();
  if (!/["“”]/.test(block)) return speakers;
  namesByEntityId.forEach((names, entityId) => {
    names.forEach((name) => {
      const escaped = escapeRegExp(name);
      const after = new RegExp(`["”]\\s*,?\\s*(?:${SPEECH_VERBS})?\\s*${escaped}\\b(?:\\s+(?:${SPEECH_VERBS}))?`, 'iu');
      const before = new RegExp(`\\b${escaped}\\s+(?:${SPEECH_VERBS})\\b[^"“]{0,40}["“]`, 'iu');
      if (after.test(block) || before.test(block)) speakers.add(entityId);
    });
  });
  return speakers;
};

const isSecondPersonBlock = (block: string): boolean => /\byou(?:r|'re|'ve)?\b/iu.test(block);

interface EntityMention {
  entityId: string;
  index: number;
}

const mentionsIn = (text: string, namesByEntityId: Map<string, string[]>): EntityMention[] => {
  const mentions: EntityMention[] = [];
  namesByEntityId.forEach((names, entityId) => {
    names.forEach((name) => {
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, 'giu');
      for (const match of text.matchAll(pattern)) {
        mentions.push({entityId, index: (match.index ?? 0) + match[1]!.length});
      }
    });
  });
  return mentions.sort((left, right) => left.index - right.index);
};

/**
 * Which known entity a claim at `index` in `block` is about: the nearest
 * preceding mention in the block, never the speaker of quoted dialogue;
 * with no usable mention, second-person or quoted blocks fall back to the
 * preceding narrative block's sole remaining entity (the addressee).
 */
export function attributeClaim(params: {
  block: string;
  index: number;
  previousBlock: string | null;
  namesByEntityId: Map<string, string[]>;
}): string | null {
  const {block, index, previousBlock, namesByEntityId} = params;
  const speakers = speakerEntityIds(block, namesByEntityId);
  const candidates = mentionsIn(block, namesByEntityId).filter((mention) => !speakers.has(mention.entityId));
  const preceding = candidates.filter((mention) => mention.index <= index);
  if (preceding.length > 0) return preceding[preceding.length - 1]!.entityId;
  if (candidates.length === 1) return candidates[0]!.entityId;
  if (candidates.length === 0 && (speakers.size > 0 || isSecondPersonBlock(block)) && previousBlock) {
    const previous = Array.from(
      new Set(mentionsIn(previousBlock, namesByEntityId).map((mention) => mention.entityId))
    ).filter((entityId) => !speakers.has(entityId));
    return previous.length === 1 ? previous[0]! : null;
  }
  return null;
}

const WINDOW_AFTER = 48;
const TOKENS_BEFORE = 3;

function claimsForSlot(params: {
  block: string;
  assertion: CanonSlotAssertion;
  synonyms: Map<string, string>;
  learned: Map<string, Set<string>>;
}): Array<Pick<SceneSlotClaim, 'modifier' | 'numeric' | 'negated' | 'phrase'> & {index: number}> {
  const {block, assertion, synonyms, learned} = params;
  const learnedForSlot = learned.get(`${assertion.factType}:${assertion.headNoun}`);
  const claims: Array<Pick<SceneSlotClaim, 'modifier' | 'numeric' | 'negated' | 'phrase'> & {index: number}> = [];

  if (assertion.headNoun === null) {
    // Bare numeric fact (an age): look for "<number> years old" / "aged <number>".
    const agePattern = /\b(?:aged?\s+)?((?:\d+|[a-z]+(?:-[a-z]+)?)(?:\s+(?:years?|winters|summers)\s+old|\s+years?\s+of\s+age)|aged?\s+(\d+|[a-z]+(?:-[a-z]+)?))\b/giu;
    for (const match of block.matchAll(agePattern)) {
      const numberText = (match[2] ?? match[1] ?? '').replace(/\s+(?:years?|winters|summers)\s+old|\s+years?\s+of\s+age/iu, '');
      const numeric = parseNumber(numberText);
      if (numeric === null) continue;
      claims.push({modifier: null, numeric, negated: false, phrase: match[0].trim(), index: match.index ?? 0});
    }
    return claims;
  }

  for (const nounMatch of block.matchAll(nounPattern(assertion.headNoun))) {
    const nounIndex = nounMatch.index ?? 0;
    const nounEnd = nounIndex + nounMatch[0].length;
    const beforeStart = Math.max(0, nounIndex - 80);
    const beforeText = block.slice(beforeStart, nounIndex);
    const afterText = block.slice(nounEnd, nounEnd + WINDOW_AFTER);
    const trimPhrase = (value: string): string => value.replace(/^[\s"“”]+|[\s.,;:!?"“”]+$/g, '');
    const beforeTokens = Array.from(beforeText.matchAll(/\S+/g)).slice(-TOKENS_BEFORE);
    const afterTokens = Array.from(afterText.matchAll(/\S+/g));

    const candidates: Array<{token: string; phrase: string}> = [];
    beforeTokens.forEach((token) => {
      const start = beforeStart + (token.index ?? 0);
      candidates.push({token: token[0], phrase: trimPhrase(block.slice(start, nounEnd))});
    });
    afterTokens.forEach((token) => {
      const end = nounEnd + (token.index ?? 0) + token[0].length;
      candidates.push({token: token[0], phrase: trimPhrase(block.slice(nounIndex, end))});
    });

    const negatedNearby = NEGATION_PATTERN.test(`${beforeTokens.map((token) => token[0]).join(' ')} ${afterText}`);

    if (assertion.numeric !== null) {
      for (const candidate of candidates) {
        const numeric = parseNumber(candidate.token);
        if (numeric === null) continue;
        claims.push({modifier: null, numeric, negated: negatedNearby, phrase: candidate.phrase.trim(), index: nounIndex});
        break;
      }
      continue;
    }

    for (const candidate of candidates) {
      const token = normalizeSlotToken(candidate.token, synonyms);
      if (!token || SLOT_STOP_WORDS.has(token)) continue;
      if (token === assertion.modifier) {
        claims.push({modifier: token, numeric: null, negated: negatedNearby, phrase: candidate.phrase.trim(), index: nounIndex});
        break;
      }
      if (COLOR_CLASS.has(token) || learnedForSlot?.has(token)) {
        claims.push({modifier: token, numeric: null, negated: false, phrase: candidate.phrase.trim(), index: nounIndex});
        break;
      }
    }
  }
  return claims;
}

export function findSlotConflicts(params: {
  documents: WritingDocument[];
  assertions: CanonSlotAssertion[];
  knownEntities: KnownEntityRef[];
  options?: SlotComparisonOptions;
}): SlotConflict[] {
  const synonyms = buildSynonymMap(params.options);
  const learned = learnValueClasses(params.assertions);
  const namesByEntityId = new Map<string, string[]>();
  params.knownEntities.forEach((entity) => {
    const names = namesByEntityId.get(entity.id) ?? [];
    names.push(entity.name);
    namesByEntityId.set(entity.id, names);
  });
  const conflicts: SlotConflict[] = [];
  params.documents.forEach((doc) => {
    const blocks = splitReviewBlocks(doc.content);
    blocks.forEach((block, blockIndex) => {
      const previousBlock = blocks[blockIndex - 1] ?? null;
      params.assertions.forEach((assertion) => {
        claimsForSlot({block, assertion, synonyms, learned}).forEach(({index, ...claim}) => {
          const attributed = attributeClaim({block, index, previousBlock, namesByEntityId});
          if (attributed !== assertion.entityId) return;
          const scene: SceneSlotClaim = {
            entityId: assertion.entityId,
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            headNoun: assertion.headNoun,
            ...claim
          };
          if (assertion.numeric !== null) {
            if (claim.numeric !== null && claim.numeric !== assertion.numeric) {
              conflicts.push({canon: assertion, scene, reason: 'number'});
            }
            return;
          }
          if (claim.modifier === assertion.modifier) {
            if (claim.negated) conflicts.push({canon: assertion, scene, reason: 'negation'});
            return;
          }
          if (
            claim.modifier &&
            assertion.modifier &&
            isComparable(assertion.modifier, claim.modifier, learned.get(`${assertion.factType}:${assertion.headNoun}`))
          ) {
            conflicts.push({canon: assertion, scene, reason: 'value-class'});
          }
        });
      });
    });
  });
  return conflicts;
}
