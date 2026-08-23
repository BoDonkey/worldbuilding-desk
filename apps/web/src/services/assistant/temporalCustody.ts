import type {WritingDocument} from '../../entityTypes';
import type {RAGSearchResult} from '../rag/types';

const STORAGE_QUESTION_PATTERN =
  /^where (?:is|are|was|were) (.+?) (?:kept|stored|held|secured)\??$/i;

const STORAGE_CONTAINER =
  "(?:(?:[A-Z][A-Za-z'’-]*['’]s|my|his|her|their)\\s+)?(?:deep\\s+)?(?:vault|cabinet|safe|armory|archive|locker|storehouse)";

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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

const getStorageBase = (location: string): string =>
  normalize(location)
    .replace(/^(?:my|his|her|their)\s+/, '')
    .replace(/^[a-z0-9]+ s\s+/, '');

const getLocationSpecificity = (location: string): number => {
  const normalized = normalize(location);
  const hasNamedPossessor = /^[A-Z][A-Za-z'’-]*['’]s\b/.test(location);
  return normalized.length + (hasNamedPossessor ? 100 : 0);
};

type CustodyEventKind =
  | 'designated-storage'
  | 'removed-from-storage'
  | 'held-by'
  | 'used-by';

type CustodyEvent = {
  kind: CustodyEventKind;
  scene: WritingDocument;
  position: number;
  location?: string;
  holder?: string;
};

const getParagraphActor = (
  paragraph: string,
  previousActor: string | null
): string | null => {
  const explicit = paragraph.match(
    /^([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})\s+(?:came|carried|held|inserted|opened|pocketed|pressed|produced|pulled|set|stood|stopped|took|turned|used|went)\b/
  );
  if (explicit?.[1] && !/^(?:He|She|They|The)$/i.test(explicit[1])) {
    return explicit[1];
  }
  return /^(?:He|She|They)\b/.test(paragraph) ? previousActor : null;
};

const extractSceneEvents = (
  scene: WritingDocument,
  subject: string
): CustodyEvent[] => {
  const subjectPattern = getSubjectPattern(subject);
  const events: CustodyEvent[] = [];
  let activeActor: string | null = null;
  let cursor = 0;

  for (const paragraph of scene.content.split(/\n\s*\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      cursor += paragraph.length + 2;
      continue;
    }
    const paragraphActor = getParagraphActor(trimmed, activeActor);
    if (paragraphActor) activeActor = paragraphActor;
    const mentionsSubject = new RegExp(`\\b${subjectPattern}\\b`, 'i').test(trimmed);
    if (!mentionsSubject) {
      cursor += paragraph.length + 2;
      continue;
    }

    const storagePattern = new RegExp(
      `\\b${subjectPattern}\\s+(?:goes|went|is|was)\\s*(?:kept|stored|held|secured|put|placed)?\\s*(?:in|into|at|inside)\\s+(?:the\\s+)?(${STORAGE_CONTAINER})`,
      'gi'
    );
    for (const match of trimmed.matchAll(storagePattern)) {
      if (match[1]) {
        events.push({
          kind: 'designated-storage',
          scene,
          position: cursor + (match.index ?? 0),
          location: match[1].trim()
        });
      }
    }

    const signOutPattern = new RegExp(
      `\\bsigned out of\\s+(?:the\\s+)?(${STORAGE_CONTAINER})`,
      'gi'
    );
    for (const match of trimmed.matchAll(signOutPattern)) {
      if (match[1]) {
        events.push({
          kind: 'removed-from-storage',
          scene,
          position: cursor + (match.index ?? 0),
          location: match[1].trim()
        });
      }
    }

    const pocketPattern = new RegExp(
      `\\b${subjectPattern}[\\s\\S]{0,180}?\\b(?:gone|put|placed|slid|went)\\s+(?:back\\s+)?(?:in|into|to)\\s+([A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+)*)['’]s(?:\\s+[a-z-]+)?\\s+pocket\\b`,
      'gi'
    );
    for (const match of trimmed.matchAll(pocketPattern)) {
      if (match[1]) {
        events.push({
          kind: 'held-by',
          scene,
          position: cursor + (match.index ?? 0),
          holder: match[1].trim()
        });
      }
    }

    const usePattern = new RegExp(
      `\\b(?:inserted|pressed|used|turned)\\s+${subjectPattern}\\b`,
      'i'
    );
    const useMatch = trimmed.match(usePattern);
    if (useMatch && activeActor) {
      events.push({
        kind: 'used-by',
        scene,
        position: cursor + (useMatch.index ?? 0),
        holder: activeActor
      });
    }

    cursor += paragraph.length + 2;
  }

  return events.sort((left, right) => left.position - right.position);
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

const uniqueSceneResults = (events: CustodyEvent[]): RAGSearchResult[] => {
  const seen = new Set<string>();
  const results: RAGSearchResult[] = [];
  events.forEach((event, index) => {
    if (seen.has(event.scene.id)) return;
    seen.add(event.scene.id);
    results.push(sceneResult(event.scene, Math.max(1, 2 - index * 0.1)));
  });
  return results;
};

const selectStorageLabel = (events: CustodyEvent[]): string | null => {
  const locations = events
    .map((event) => event.location)
    .filter((location): location is string => Boolean(location));
  if (locations.length === 0) return null;
  return [...locations].sort(
    (left, right) => getLocationSpecificity(right) - getLocationSpecificity(left)
  )[0] ?? null;
};

const resolveManuscriptEvidence = (
  subject: string,
  orderedScenes: WritingDocument[]
): TemporalCustodyAnswer | null => {
  const events = orderedScenes.flatMap((scene) => extractSceneEvents(scene, subject));
  if (events.length === 0) return null;

  const designations = events.filter((event) => event.kind === 'designated-storage');
  const latestDesignation = designations[designations.length - 1];
  if (!latestDesignation) {
    return {
      content: `Saved manuscript passages describe custody changes for ${subject}, but do not establish one current storage location. Current custody is uncertain.`,
      results: uniqueSceneResults(events)
    };
  }

  const designationIndex = events.indexOf(latestDesignation);
  const laterCustody = events.slice(designationIndex + 1).filter(
    (event) => event.kind !== 'designated-storage'
  );
  const designationBase = getStorageBase(latestDesignation.location ?? '');
  const relatedStorageEvents = [latestDesignation, ...laterCustody.filter(
    (event) =>
      event.kind === 'removed-from-storage' &&
      getStorageBase(event.location ?? '') === designationBase
  )];
  const storageLabel = selectStorageLabel(relatedStorageEvents) ?? latestDesignation.location;
  if (!storageLabel) return null;

  if (laterCustody.length === 0) {
    return {
      content: `${capitalize(subject)} is designated to be kept in ${storageLabel}.`,
      results: uniqueSceneResults([latestDesignation])
    };
  }

  const holderEvents = laterCustody.filter((event) => Boolean(event.holder));
  const holderNames = Array.from(
    new Map(
      holderEvents.map((event) => [normalize(event.holder ?? ''), event.holder ?? ''])
    ).values()
  ).filter(Boolean);
  const removalEvent = laterCustody.find((event) => event.kind === 'removed-from-storage');
  const details: string[] = [];
  if (removalEvent) {
    details.push(
      `${removalEvent.scene.title || 'A later scene'} says it was signed out`
    );
  }
  holderEvents.forEach((event) => {
    const action = event.kind === 'used-by' ? 'uses it' : 'has it in a pocket';
    details.push(`${event.scene.title || 'A later scene'} says ${event.holder} ${action}`);
  });

  const transitionWarning = holderNames.length > 1
    ? ' No transfer between those holders is established.'
    : '';
  return {
    content: `The designated storage for ${subject} is ${storageLabel}, but later saved scenes do not support saying it is currently there. ${details.join('; ')}.${transitionWarning} Current custody is uncertain.`,
    results: uniqueSceneResults([latestDesignation, ...laterCustody])
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
