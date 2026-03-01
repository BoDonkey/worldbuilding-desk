import type {
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
  sceneId?: string;
}

interface SceneConflictItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
}

interface ContradictionInput {
  documents: WritingDocument[];
  entities: WorldEntity[];
  characters: Character[];
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

const buildEntityLookup = (
  knownEntities: KnownEntityRef[]
): {
  byNormalizedName: Map<string, string>;
  byId: Map<string, KnownEntityRef>;
} => {
  const normalizedToIds = new Map<string, Set<string>>();
  const byId = new Map<string, KnownEntityRef>();

  knownEntities.forEach((entity) => {
    byId.set(entity.id, entity);
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

export const findCanonContradictions = ({
  documents,
  entities,
  characters,
  knownEntities
}: ContradictionInput): SceneConflictItem[] => {
  const {byNormalizedName, byId} = buildEntityLookup(knownEntities);
  const canonAssertions = buildCanonAssertions(entities, characters, byNormalizedName);
  const sceneAssertions = buildSceneAssertions(documents, byNormalizedName);

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
      contradiction.sourceType === 'world'
        ? `World Bible entry "${contradiction.sourceTitle}"`
        : `Character record "${contradiction.sourceTitle}"`;

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
        surface: entity?.name,
        relatedEntities: entity ? [entity] : undefined
      }
    });
  });

  return items;
};
