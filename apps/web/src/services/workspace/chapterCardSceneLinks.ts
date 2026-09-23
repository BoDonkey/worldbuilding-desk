import type {ChapterCard, WritingDocument} from '../../entityTypes';

const uniqueSceneIds = (sceneIds: readonly string[] | undefined): string[] => {
  const seen = new Set<string>();
  return (sceneIds ?? []).filter((sceneId) => {
    if (seen.has(sceneId)) return false;
    seen.add(sceneId);
    return true;
  });
};

/** Explicit-id link toggle. No title, order, or other content is considered. */
export function toggleSceneLink(card: ChapterCard, sceneId: string): string[] {
  const sceneIds = uniqueSceneIds(card.sceneIds);
  return sceneIds.includes(sceneId)
    ? sceneIds.filter((id) => id !== sceneId)
    : [...sceneIds, sceneId];
}

/** Adds one explicit id once, preserving the card's existing link order. */
export function addSceneLink(card: ChapterCard, sceneId: string): string[] {
  const sceneIds = uniqueSceneIds(card.sceneIds);
  return sceneIds.includes(sceneId) ? sceneIds : [...sceneIds, sceneId];
}

/** Removes every occurrence of one explicit id while preserving remaining order. */
export function removeSceneLink(card: ChapterCard, sceneId: string): string[] {
  return uniqueSceneIds(card.sceneIds).filter((id) => id !== sceneId);
}

export function resolveSceneLinks(
  card: ChapterCard,
  documents: WritingDocument[]
): {linked: WritingDocument[]; missingSceneIds: string[]} {
  const sceneIds = uniqueSceneIds(card.sceneIds);
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  return {
    linked: sceneIds.flatMap((sceneId) => {
      const document = documentsById.get(sceneId);
      return document ? [document] : [];
    }),
    missingSceneIds: sceneIds.filter((sceneId) => !documentsById.has(sceneId))
  };
}
