import type {WritingDocument} from '../../entityTypes';
import {
  analyzeManuscriptCustody,
  getStorageBase,
  type ManuscriptCustodyEvent
} from '../state/manuscriptCustody';
import type {RAGSearchResult} from '../rag/types';

const STORAGE_QUESTION_PATTERN =
  /^where (?:is|are|was|were) (.+?) (?:kept|stored|held|secured)\??$/i;

const STORAGE_CONTAINER =
  "(?:(?:[A-Z][A-Za-z'’-]*['’]s|my|his|her|their)\\s+)?(?:deep\\s+)?(?:vault|cabinet|safe|armory|archive|locker|storehouse)";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const capitalize = (value: string): string =>
  value ? `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}` : value;

const getSubjectPattern = (subject: string): string => {
  const withoutArticle = subject.trim().replace(/^the\s+/i, '');
  const words = withoutArticle.split(/\s+/).filter(Boolean);
  const head = words[words.length - 1] ?? withoutArticle;
  return `(?:the\\s+)?(?:${escapeRegex(withoutArticle)}|${escapeRegex(head)})`;
};

const getLocationSpecificity = (location: string): number => {
  const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hasNamedPossessor = /^[A-Z][A-Za-z'’-]*['’]s\b/.test(location);
  return normalized.length + (hasNamedPossessor ? 100 : 0);
};

const sceneResult = (scene: WritingDocument, score: number): RAGSearchResult => ({
  score,
  chunk: {
    id: `saved-scene:${scene.id}`,
    documentId: scene.id,
    documentTitle: scene.title || 'Untitled scene',
    content: scene.content,
    metadata: {type: 'scene'}
  }
});

const uniqueSceneResults = (events: ManuscriptCustodyEvent[]): RAGSearchResult[] => {
  const seen = new Set<string>();
  const results: RAGSearchResult[] = [];
  events.forEach((event, index) => {
    if (seen.has(event.scene.id)) return;
    seen.add(event.scene.id);
    results.push(sceneResult(event.scene, Math.max(1, 2 - index * 0.1)));
  });
  return results;
};

const resolveManuscriptEvidence = (
  subject: string,
  orderedScenes: WritingDocument[]
): TemporalCustodyAnswer | null => {
  const analysis = analyzeManuscriptCustody(subject, orderedScenes);
  if (analysis.events.length === 0) return null;
  if (!analysis.latestDesignation) {
    return {
      content: `Saved manuscript passages describe custody changes for ${subject}, but do not establish one current storage location. Current custody is uncertain.`,
      results: uniqueSceneResults(analysis.events)
    };
  }
  if (!analysis.storageLabel) return null;
  if (analysis.laterCustody.length === 0) {
    return {
      content: `${capitalize(subject)} is designated to be kept in ${analysis.storageLabel}.`,
      results: uniqueSceneResults([analysis.latestDesignation])
    };
  }

  const holderEvents = analysis.laterCustody.filter((event) => Boolean(event.holder));
  const removalEvent = analysis.laterCustody.find(
    (event) => event.kind === 'removed-from-storage'
  );
  const details: string[] = [];
  if (removalEvent) {
    details.push(`${removalEvent.scene.title || 'A later scene'} says it was signed out`);
  }
  holderEvents.forEach((event) => {
    const action = event.kind === 'used-by' ? 'uses it' : 'has it in a pocket';
    details.push(`${event.scene.title || 'A later scene'} says ${event.holder} ${action}`);
  });
  const transitionWarning = analysis.holderNames.length > 1
    ? ' No transfer between those holders is established.'
    : '';
  return {
    content: `The designated storage for ${subject} is ${analysis.storageLabel}, but later saved scenes do not support saying it is currently there. ${details.join('; ')}.${transitionWarning} Current custody is uncertain.`,
    results: uniqueSceneResults([analysis.latestDesignation, ...analysis.laterCustody])
  };
};

const extractTrustedStorageFallback = (
  subject: string,
  results: RAGSearchResult[]
): TemporalCustodyAnswer | null => {
  const subjectPattern = getSubjectPattern(subject);
  const evidence = results.flatMap((result) => {
    if (!['canon_fact', 'worldbible'].includes(result.chunk.metadata.type)) return [];
    const pattern = new RegExp(
      `\\b${subjectPattern}\\s+(?:is|was)\\s+(?:kept|stored|held|secured)\\s+(?:in|at|inside)\\s+(?:the\\s+)?(${STORAGE_CONTAINER})`,
      'i'
    );
    const location = result.chunk.content.match(pattern)?.[1]?.trim();
    return location ? [{location, result}] : [];
  });
  if (evidence.length === 0) return null;
  const bases = new Set(evidence.map((entry) => getStorageBase(entry.location)));
  if (bases.size > 1) {
    return {
      content: `Accepted project records give conflicting storage locations for ${subject}, so I won't choose one.`,
      results: evidence.map((entry) => entry.result)
    };
  }
  const selectedEvidence = [...evidence].sort(
    (left, right) => getLocationSpecificity(right.location) - getLocationSpecificity(left.location)
  )[0];
  return selectedEvidence
    ? {
        content: `${capitalize(subject)} is designated to be kept in ${selectedEvidence.location}.`,
        results: [selectedEvidence.result]
      }
    : null;
};

export type TemporalCustodyAnswer = {
  content: string;
  results: RAGSearchResult[];
};

export const getTemporalCustodySubject = (promptText: string): string | null =>
  promptText.trim().match(STORAGE_QUESTION_PATTERN)?.[1]?.trim() ?? null;

export const resolveTemporalCustodyAnswer = (
  promptText: string,
  orderedScenes: WritingDocument[],
  trustedResults: RAGSearchResult[]
): TemporalCustodyAnswer | null => {
  const subject = getTemporalCustodySubject(promptText);
  if (!subject) return null;
  return resolveManuscriptEvidence(subject, orderedScenes) ??
    extractTrustedStorageFallback(subject, trustedResults);
};
