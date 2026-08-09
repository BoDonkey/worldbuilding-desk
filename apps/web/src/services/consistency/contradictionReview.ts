import type {
  CanonicalFact,
  Character,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {htmlToPlainText} from '../../utils/textHelpers';
import type {GuardrailIssue, KnownEntityRef} from './types';

const normalizePhrase = (value: string): string =>
  value
    .trim()
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeDescriptor = (value: string): string =>
  normalizePhrase(
    value
      .replace(/^(a|an|the)\s+/i, '')
      .replace(/[.,!?;:]+$/g, '')
  );

const ASSERTION_PATTERN =
  /\b([A-Z][A-Za-z0-9'_-]*(?:\s+[A-Z][A-Za-z0-9'_-]*){0,2})\s+(is|are|was|were)\s+(not\s+)?([A-Za-z][A-Za-z0-9'_-]*(?:\s+[A-Za-z][A-Za-z0-9'_-]*){0,3})\b/g;

interface Assertion {
  entityId: string;
  descriptor: string;
  negative: boolean;
  phrase: string;
  sourceType: 'scene' | 'world' | 'character';
  sourceId: string;
  sourceTitle: string;
  sourceDetail?: string;
  sceneId?: string;
}

interface SceneConflictItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
}

interface AttributeAssertion {
  entityId: string;
  attribute: 'eye-color';
  value: string;
  phrase: string;
  sourceId: string;
  sourceTitle: string;
  sourceDetail?: string;
  sceneId?: string;
}

interface ContradictionInput {
  documents: WritingDocument[];
  entities: WorldEntity[];
  characters: Character[];
  canonicalFacts: CanonicalFact[];
  knownEntities: KnownEntityRef[];
}

const toStringFieldValues = (fields: Record<string, unknown>): string[] =>
  Object.values(fields).flatMap((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value)];
    }
    return [];
  });

const EYE_COLOR_PATTERN =
  /\b(amber|black|blue|brown|gold|golden|gray|green|grey|hazel|red|silver|violet|white)\b/iu;

const normalizeEyeColor = (value: string): string | null => {
  const match = value.match(EYE_COLOR_PATTERN)?.[1]?.toLowerCase();
  if (!match) return null;
  return match === 'grey' ? 'gray' : match;
};

const extractEyeColorClaim = (
  text: string
): {value: string; phrase: string} | null => {
  const colorBeforeEyes = text.match(
    /\b(amber|black|blue|brown|gold|golden|gray|green|grey|hazel|red|silver|violet|white)\b(?:-colored)?\s+eyes\b/iu
  );
  const eyesBeforeColor = text.match(
    /\beyes\b[\s\S]{0,48}?\b(amber|black|blue|brown|gold|golden|gray|green|grey|hazel|red|silver|violet|white)\b/iu
  );
  const match = colorBeforeEyes ?? eyesBeforeColor;
  if (!match?.[1]) return null;

  return {
    value: normalizeEyeColor(match[1]) ?? match[1].toLowerCase(),
    phrase: match[0].replace(/\s+/g, ' ').trim()
  };
};

const buildEntityLookup = (
  knownEntities: KnownEntityRef[]
): {
  byNormalizedName: Map<string, string>;
  byId: Map<string, KnownEntityRef>;
} => {
  const normalizedToIds = new Map<string, Set<string>>();
  const byId = new Map<string, KnownEntityRef>();

  knownEntities.forEach((entity) => {
    if (!byId.has(entity.id)) {
      byId.set(entity.id, entity);
    }
    const normalized = normalizePhrase(entity.name);
    if (!normalized) return;
    const existing = normalizedToIds.get(normalized) ?? new Set<string>();
    existing.add(entity.id);
    normalizedToIds.set(normalized, existing);
  });

  const byNormalizedName = new Map<string, string>();
  normalizedToIds.forEach((ids, normalized) => {
    if (ids.size === 1) {
      const [id] = Array.from(ids);
      byNormalizedName.set(normalized, id);
    }
  });

  return {byNormalizedName, byId};
};

const extractAssertions = (
  text: string,
  source: Omit<Assertion, 'entityId' | 'descriptor' | 'negative' | 'phrase'>
    & {lookup: Map<string, string>}
): Assertion[] => {
  const assertions: Assertion[] = [];
  for (const match of text.matchAll(ASSERTION_PATTERN)) {
    const subject = match[1] ?? '';
    const descriptorRaw = match[4] ?? '';
    const subjectNormalized = normalizePhrase(subject);
    const descriptor = normalizeDescriptor(descriptorRaw);
    const entityId = source.lookup.get(subjectNormalized);
    if (!entityId || !descriptor) {
      continue;
    }

    if (descriptor.length < 3 || descriptor.length > 48) {
      continue;
    }

    assertions.push({
      entityId,
      descriptor,
      negative: Boolean(match[3]),
      phrase: (match[0] ?? '').trim(),
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceTitle: source.sourceTitle,
      sceneId: source.sceneId
    });
  }
  return assertions;
};

const buildCanonAssertions = (
  entities: WorldEntity[],
  characters: Character[],
  canonicalFacts: CanonicalFact[],
  lookup: Map<string, string>
): Assertion[] => {
  const assertions: Assertion[] = [];

  entities.forEach((entity) => {
    const textSegments = [
      ...toStringFieldValues(entity.fields),
      entity.name
    ].join('. ');
    assertions.push(
      ...extractAssertions(textSegments, {
        lookup,
        sourceType: 'world',
        sourceId: entity.id,
        sourceTitle: entity.name
      })
    );
  });

  characters.forEach((character) => {
    const textSegments = [
      character.description ?? '',
      ...toStringFieldValues(character.fields),
      character.name
    ]
      .filter(Boolean)
      .join('. ');
    assertions.push(
      ...extractAssertions(textSegments, {
        lookup,
        sourceType: 'character',
        sourceId: character.id,
        sourceTitle: character.name
      })
    );
  });

  canonicalFacts.forEach((fact) => {
    const knownTargetName = fact.targetName?.trim();
    const targetName =
      knownTargetName ||
      (fact.targetType === 'character'
        ? characters.find((character) => character.id === fact.targetId)?.name
        : entities.find((entity) => entity.id === fact.targetId)?.name) ||
      '';
    const subjectNormalized = normalizePhrase(targetName);
    const entityId = lookup.get(subjectNormalized);
    if (!entityId) {
      return;
    }

    const value =
      typeof fact.value === 'string'
        ? fact.value
        : fact.value.value || `${fact.value.label} ${fact.value.value}`;
    const descriptor = normalizeDescriptor(value);
    if (!descriptor) {
      return;
    }

    assertions.push({
      entityId,
      descriptor,
      negative: false,
      phrase: `${targetName} is ${value}`.trim(),
      sourceType: fact.targetType === 'character' ? 'character' : 'world',
      sourceId: fact.id,
      sourceTitle: targetName || fact.targetId,
      sourceDetail: fact.sourceLoreDocumentTitle
        ? `accepted lore fact from "${fact.sourceLoreDocumentTitle}"`
        : 'accepted lore fact'
    });
  });

  return assertions;
};

const buildSceneAssertions = (
  documents: WritingDocument[],
  lookup: Map<string, string>
): Assertion[] =>
  documents.flatMap((doc) =>
    extractAssertions(htmlToPlainText(doc.content), {
      lookup,
      sourceType: 'scene',
      sourceId: doc.id,
      sourceTitle: doc.title || 'Untitled scene',
      sceneId: doc.id
    })
  );

const buildCanonEyeColorAssertions = (
  canonicalFacts: CanonicalFact[],
  lookup: Map<string, string>,
  entities: WorldEntity[],
  characters: Character[]
): AttributeAssertion[] =>
  canonicalFacts.flatMap((fact) => {
    if (fact.factType !== 'appearance') return [];
    const value =
      typeof fact.value === 'string'
        ? fact.value
        : `${fact.value.label} ${fact.value.value}`;
    const eyeColor = extractEyeColorClaim(value);
    if (!eyeColor) return [];

    const targetName =
      fact.targetName?.trim() ||
      (fact.targetType === 'character'
        ? characters.find((character) => character.id === fact.targetId)?.name
        : entities.find((entity) => entity.id === fact.targetId)?.name) ||
      '';
    const entityId = lookup.get(normalizePhrase(targetName));
    if (!entityId) return [];

    return [{
      entityId,
      attribute: 'eye-color' as const,
      value: eyeColor.value,
      phrase: `${targetName} has ${value}`,
      sourceId: fact.id,
      sourceTitle: targetName || fact.targetId,
      sourceDetail: fact.sourceLoreDocumentTitle
        ? `accepted lore fact from "${fact.sourceLoreDocumentTitle}"`
        : 'accepted lore fact'
    }];
  });

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const splitReviewBlocks = (content: string): string[] =>
  content
    .split(
      /(?:\r?\n\s*){2,}|<\/(?:blockquote|div|h[1-6]|li|p)>\s*/iu
    )
    .map((block) => htmlToPlainText(block))
    .filter(Boolean);

const isSecondPersonEyeClaim = (block: string): boolean =>
  /\b(?:you\b[\s\S]{0,160}?\beyes|your\s+eyes)\b/iu.test(block);

const buildSceneEyeColorAssertions = (
  documents: WritingDocument[],
  canonAssertions: AttributeAssertion[],
  knownEntities: KnownEntityRef[]
): AttributeAssertion[] => {
  const canonEntityIds = new Set(canonAssertions.map((assertion) => assertion.entityId));
  const namesByEntityId = new Map<string, string[]>();
  knownEntities.forEach((entity) => {
    if (!canonEntityIds.has(entity.id)) return;
    const names = namesByEntityId.get(entity.id) ?? [];
    names.push(entity.name);
    namesByEntityId.set(entity.id, names);
  });

  return documents.flatMap((doc) => {
    const blocks = splitReviewBlocks(doc.content);
    return blocks.flatMap((block, blockIndex) => {
      const claim = extractEyeColorClaim(block);
      if (!claim) return [];

      const entityIdsMentionedIn = (text: string): string[] =>
        Array.from(namesByEntityId.entries())
          .filter(([, names]) =>
            names.some((name) =>
              new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
                .test(text)
            )
          )
          .map(([entityId]) => entityId);

      let matchingEntityIds = entityIdsMentionedIn(block);
      if (matchingEntityIds.length === 0 && isSecondPersonEyeClaim(block)) {
        matchingEntityIds = entityIdsMentionedIn(blocks[blockIndex - 1] ?? '');
      }

      // Attribute a claim only when accepted canon makes the subject
      // unambiguous in the same block. Second-person dialogue may use the
      // immediately preceding narrative block to identify its addressee.
      if (matchingEntityIds.length !== 1) return [];

      return [{
        entityId: matchingEntityIds[0]!,
        attribute: 'eye-color' as const,
        value: claim.value,
        phrase: claim.phrase,
        sourceId: doc.id,
        sourceTitle: doc.title || 'Untitled scene',
        sceneId: doc.id
      }];
    });
  });
};

export const findCanonContradictions = ({
  documents,
  entities,
  characters,
  canonicalFacts,
  knownEntities
}: ContradictionInput): SceneConflictItem[] => {
  const {byNormalizedName, byId} = buildEntityLookup(knownEntities);
  const canonAssertions = buildCanonAssertions(
    entities,
    characters,
    canonicalFacts,
    byNormalizedName
  );
  const sceneAssertions = buildSceneAssertions(documents, byNormalizedName);
  const canonEyeColorAssertions = buildCanonEyeColorAssertions(
    canonicalFacts,
    byNormalizedName,
    entities,
    characters
  );
  const sceneEyeColorAssertions = buildSceneEyeColorAssertions(
    documents,
    canonEyeColorAssertions,
    knownEntities
  );

  const canonByEntityDescriptor = new Map<string, Assertion[]>();
  canonAssertions.forEach((assertion) => {
    const key = `${assertion.entityId}:${assertion.descriptor}`;
    const existing = canonByEntityDescriptor.get(key) ?? [];
    existing.push(assertion);
    canonByEntityDescriptor.set(key, existing);
  });

  const seen = new Set<string>();
  const items: SceneConflictItem[] = [];

  sceneAssertions.forEach((sceneAssertion) => {
    const key = `${sceneAssertion.entityId}:${sceneAssertion.descriptor}`;
    const canonMatches = canonByEntityDescriptor.get(key) ?? [];
    const contradiction = canonMatches.find(
      (canonAssertion) => canonAssertion.negative !== sceneAssertion.negative
    );
    if (!contradiction || !sceneAssertion.sceneId) {
      return;
    }

    const dedupeKey = `${sceneAssertion.sceneId}:${sceneAssertion.entityId}:${sceneAssertion.descriptor}:${sceneAssertion.negative}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    const entity = byId.get(sceneAssertion.entityId);
    const sceneClaim = `'${sceneAssertion.phrase}'`;
    const canonClaim = `'${contradiction.phrase}'`;
    const canonSource =
      contradiction.sourceDetail ??
      (contradiction.sourceType === 'world'
        ? `World Bible entry "${contradiction.sourceTitle}"`
        : `Character record "${contradiction.sourceTitle}"`);

    items.push({
      id: `conflict:${dedupeKey}`,
      sceneId: sceneAssertion.sceneId,
      sceneTitle: sceneAssertion.sourceTitle,
      issue: {
        code: 'STATE_CONFLICT',
        severity: 'blocking',
        message:
          `Canon conflict for ${entity?.name ?? 'entity'}: scene states ${sceneClaim}, ` +
          `but ${canonSource} states ${canonClaim}.`,
        focusText: sceneAssertion.phrase,
        relatedEntities: entity ? [entity] : undefined
      }
    });
  });

  sceneEyeColorAssertions.forEach((sceneAssertion) => {
    const contradiction = canonEyeColorAssertions.find(
      (canonAssertion) =>
        canonAssertion.entityId === sceneAssertion.entityId &&
        canonAssertion.attribute === sceneAssertion.attribute &&
        canonAssertion.value !== sceneAssertion.value
    );
    if (!contradiction || !sceneAssertion.sceneId) return;

    const dedupeKey =
      `${sceneAssertion.sceneId}:${sceneAssertion.entityId}:` +
      `${sceneAssertion.attribute}:${sceneAssertion.value}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const entity = byId.get(sceneAssertion.entityId);
    items.push({
      id: `conflict:${dedupeKey}`,
      sceneId: sceneAssertion.sceneId,
      sceneTitle: sceneAssertion.sourceTitle,
      issue: {
        code: 'STATE_CONFLICT',
        severity: 'blocking',
        message:
          `Canon conflict for ${entity?.name ?? 'entity'}: scene describes eye color as ` +
          `'${sceneAssertion.phrase}', but ${contradiction.sourceDetail ?? 'accepted canon'} ` +
          `states '${contradiction.phrase}'.`,
        focusText: sceneAssertion.phrase,
        relatedEntities: entity ? [entity] : undefined
      }
    });
  });

  return items;
};
