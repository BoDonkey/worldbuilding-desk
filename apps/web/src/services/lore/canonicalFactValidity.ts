import type {CanonicalFact, WritingDocument} from '../../entityTypes';
import type {RAGSearchResult} from '../rag/types';

const VALID_FROM_TAG = 'canon-valid-from:';
const VALID_UNTIL_TAG = 'canon-valid-until:';

function sceneIndexes(documents: WritingDocument[]): Map<string, number> {
  return new Map(documents.map((document, index) => [document.id, index]));
}

/**
 * Resolve a fact's stable scene-id boundaries against the manuscript's current
 * order. `validFromSceneId` is inclusive and `validUntilSceneId` is exclusive.
 * Missing boundary scenes fail closed for bounded facts instead of guessing.
 */
export function isCanonicalFactValidAtScene(
  fact: CanonicalFact,
  sceneId: string,
  documents: WritingDocument[]
): boolean {
  if (!fact.validFromSceneId && !fact.validUntilSceneId) return true;
  const indexes = sceneIndexes(documents);
  const sceneIndex = indexes.get(sceneId);
  if (sceneIndex === undefined) return false;
  if (fact.validFromSceneId) {
    const fromIndex = indexes.get(fact.validFromSceneId);
    if (fromIndex === undefined || sceneIndex < fromIndex) return false;
  }
  if (fact.validUntilSceneId) {
    const untilIndex = indexes.get(fact.validUntilSceneId);
    if (untilIndex === undefined || sceneIndex >= untilIndex) return false;
  }
  return true;
}

export function getCanonicalFactsValidAtScene(
  facts: CanonicalFact[],
  sceneId: string,
  documents: WritingDocument[]
): CanonicalFact[] {
  return facts.filter((fact) => isCanonicalFactValidAtScene(fact, sceneId, documents));
}

export function validateCanonicalFactWindow(
  fact: Pick<CanonicalFact, 'validFromSceneId' | 'validUntilSceneId'>,
  documents: WritingDocument[]
): void {
  const indexes = sceneIndexes(documents);
  const fromIndex = fact.validFromSceneId
    ? indexes.get(fact.validFromSceneId)
    : undefined;
  const untilIndex = fact.validUntilSceneId
    ? indexes.get(fact.validUntilSceneId)
    : undefined;
  if (fact.validFromSceneId && fromIndex === undefined) {
    throw new Error('The starting scene is no longer in this manuscript.');
  }
  if (fact.validUntilSceneId && untilIndex === undefined) {
    throw new Error('The ending scene is no longer in this manuscript.');
  }
  if (fromIndex !== undefined && untilIndex !== undefined && fromIndex >= untilIndex) {
    throw new Error('A canon fact must start before the scene where it stops applying.');
  }
}

export function getCanonicalFactValidityTags(
  fact: Pick<CanonicalFact, 'validFromSceneId' | 'validUntilSceneId'>
): string[] {
  return [
    fact.validFromSceneId ? `${VALID_FROM_TAG}${fact.validFromSceneId}` : null,
    fact.validUntilSceneId ? `${VALID_UNTIL_TAG}${fact.validUntilSceneId}` : null
  ].filter((tag): tag is string => Boolean(tag));
}

function boundaryFromTags(tags: string[] | undefined, prefix: string): string | undefined {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || undefined;
}

export function isCanonFactResultValidAtScene(
  result: RAGSearchResult,
  sceneId: string,
  documents: WritingDocument[]
): boolean {
  if (result.chunk.metadata.type !== 'canon_fact') return true;
  return isCanonicalFactValidAtScene({
    validFromSceneId: boundaryFromTags(result.chunk.metadata.tags, VALID_FROM_TAG),
    validUntilSceneId: boundaryFromTags(result.chunk.metadata.tags, VALID_UNTIL_TAG)
  } as CanonicalFact, sceneId, documents);
}

export function filterCanonFactResultsForScene(
  results: RAGSearchResult[],
  sceneId: string | undefined,
  documents: WritingDocument[]
): RAGSearchResult[] {
  if (!sceneId) return results;
  return results.filter((result) => isCanonFactResultValidAtScene(result, sceneId, documents));
}

export function isCanonFactMemoryValidAtScene(
  tags: string[] | undefined,
  sceneId: string | undefined,
  documents: WritingDocument[]
): boolean {
  if (!sceneId || !tags?.includes('canon_fact')) return true;
  return isCanonicalFactValidAtScene({
    validFromSceneId: boundaryFromTags(tags, VALID_FROM_TAG),
    validUntilSceneId: boundaryFromTags(tags, VALID_UNTIL_TAG)
  } as CanonicalFact, sceneId, documents);
}

export function formatCanonicalFactValidity(
  fact: Pick<CanonicalFact, 'validFromSceneId' | 'validUntilSceneId'>,
  documents: WritingDocument[]
): string | null {
  if (!fact.validFromSceneId && !fact.validUntilSceneId) return null;
  const titles = new Map(documents.map((document) => [document.id, document.title || 'Untitled scene']));
  const from = fact.validFromSceneId ? titles.get(fact.validFromSceneId) : undefined;
  const until = fact.validUntilSceneId ? titles.get(fact.validUntilSceneId) : undefined;
  if (from && until) return `from ${from} until ${until}`;
  if (from) return `from ${from} onward`;
  if (until) return `before ${until}`;
  return 'within a scene range whose boundary is missing';
}

export function buildCanonicalFactSupersession(params: {
  previousFact: CanonicalFact;
  nextFact: CanonicalFact;
  asOfSceneId: string;
  documents: WritingDocument[];
}): {previousFact: CanonicalFact; nextFact: CanonicalFact} {
  const {previousFact, nextFact, asOfSceneId, documents} = params;
  if (previousFact.projectId !== nextFact.projectId) {
    throw new Error('Canon facts from different projects cannot be superseded together.');
  }
  if (
    previousFact.targetType !== nextFact.targetType ||
    previousFact.targetId !== nextFact.targetId ||
    previousFact.factType !== nextFact.factType
  ) {
    throw new Error('Only the same canon subject and fact type can be superseded.');
  }
  if (previousFact.validUntilSceneId) {
    throw new Error('This historical canon fact is already closed; supersede the current fact instead.');
  }
  const updatedPrevious = {
    ...previousFact,
    validUntilSceneId: asOfSceneId,
    updatedAt: nextFact.updatedAt
  };
  const boundedNext = {
    ...nextFact,
    validFromSceneId: asOfSceneId
  };
  validateCanonicalFactWindow(updatedPrevious, documents);
  validateCanonicalFactWindow(boundedNext, documents);
  return {previousFact: updatedPrevious, nextFact: boundedNext};
}
