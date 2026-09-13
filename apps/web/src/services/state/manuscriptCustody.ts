import type {WritingDocument} from '../../entityTypes';

export const manuscriptPlainText = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const STORAGE_CONTAINER =
  "(?:(?:[A-Z][A-Za-z'’-]*['’]s|my|his|her|their)\\s+)?(?:deep\\s+)?(?:vault|cabinet|safe|armory|archive|locker|storehouse)";

export const normalizeCustodyText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSubjectPattern = (subject: string): string => {
  const withoutArticle = subject.trim().replace(/^the\s+/i, '');
  const words = withoutArticle.split(/\s+/).filter(Boolean);
  const head = words[words.length - 1] ?? withoutArticle;
  return `(?:the\\s+)?(?:${escapeRegex(withoutArticle)}|${escapeRegex(head)})`;
};

export const getStorageBase = (location: string): string =>
  normalizeCustodyText(location)
    .replace(/^(?:my|his|her|their)\s+/, '')
    .replace(/^[a-z0-9]+ s\s+/, '');

const getLocationSpecificity = (location: string): number => {
  const normalized = normalizeCustodyText(location);
  const hasNamedPossessor = /^[A-Z][A-Za-z'’-]*['’]s\b/.test(location);
  return normalized.length + (hasNamedPossessor ? 100 : 0);
};

export type ManuscriptCustodyEventKind =
  | 'designated-storage'
  | 'removed-from-storage'
  | 'held-by'
  | 'used-by';

export interface ManuscriptCustodyEvent {
  kind: ManuscriptCustodyEventKind;
  scene: WritingDocument;
  position: number;
  evidence: string;
  location?: string;
  holder?: string;
}

export interface ManuscriptCustodyAnalysis {
  events: ManuscriptCustodyEvent[];
  latestDesignation?: ManuscriptCustodyEvent;
  laterCustody: ManuscriptCustodyEvent[];
  storageLabel?: string;
  holderNames: string[];
}

const getParagraphActor = (
  paragraph: string,
  previousActor: string | null
): string | null => {
  const explicit = paragraph.match(
    /^([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})\s+(?:attacked|came|carried|equipped|gave|handed|held|inserted|opened|passed|pocketed|pressed|produced|pulled|set|slashed|stabbed|stood|stopped|struck|took|turned|used|went|wielded)\b/
  );
  if (explicit?.[1] && !/^(?:He|She|They|The)$/i.test(explicit[1])) {
    return explicit[1];
  }
  return /^(?:He|She|They)\b/.test(paragraph) ? previousActor : null;
};

const extractSceneEvents = (
  scene: WritingDocument,
  subject: string
): ManuscriptCustodyEvent[] => {
  const plainScene = {...scene, content: manuscriptPlainText(scene.content)};
  const subjectPattern = getSubjectPattern(subject);
  const events: ManuscriptCustodyEvent[] = [];
  let activeActor: string | null = null;
  let cursor = 0;

  for (const paragraph of plainScene.content.split(/\n\s*\n/)) {
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
          scene: plainScene,
          position: cursor + (match.index ?? 0),
          evidence: match[0],
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
          scene: plainScene,
          position: cursor + (match.index ?? 0),
          evidence: match[0],
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
          scene: plainScene,
          position: cursor + (match.index ?? 0),
          evidence: match[0],
          holder: match[1].trim()
        });
      }
    }

    const usePattern = new RegExp(
      `\\b(?:attacked[^.!?]{0,80}?with|equipped|gave|handed(?:\\s+over)?|inserted|passed|pressed|slashed[^.!?]{0,80}?with|stabbed[^.!?]{0,80}?with|struck[^.!?]{0,80}?with|used|turned|wielded)\\s+${subjectPattern}\\b`,
      'i'
    );
    const useMatch = trimmed.match(usePattern);
    if (useMatch && activeActor) {
      events.push({
        kind: 'used-by',
        scene: plainScene,
        position: cursor + (useMatch.index ?? 0),
        evidence: useMatch[0],
        holder: activeActor
      });
    }

    cursor += paragraph.length + 2;
  }

  return events.sort((left, right) => left.position - right.position);
};

export const analyzeManuscriptCustody = (
  subject: string,
  orderedScenes: WritingDocument[]
): ManuscriptCustodyAnalysis => {
  const events = orderedScenes.flatMap((scene) => extractSceneEvents(scene, subject));
  const designations = events.filter((event) => event.kind === 'designated-storage');
  const latestDesignation = designations[designations.length - 1];
  const designationIndex = latestDesignation ? events.indexOf(latestDesignation) : -1;
  const laterCustody = designationIndex >= 0
    ? events.slice(designationIndex + 1).filter((event) => event.kind !== 'designated-storage')
    : events.filter((event) => event.kind === 'held-by' || event.kind === 'used-by');
  const designationBase = getStorageBase(latestDesignation?.location ?? '');
  const relatedLocations = latestDesignation
    ? [latestDesignation, ...laterCustody.filter(
        (event) =>
          event.kind === 'removed-from-storage' &&
          getStorageBase(event.location ?? '') === designationBase
      )]
        .map((event) => event.location)
        .filter((location): location is string => Boolean(location))
    : [];
  const storageLabel = [...relatedLocations].sort(
    (left, right) => getLocationSpecificity(right) - getLocationSpecificity(left)
  )[0];
  const holderNames = Array.from(
    new Map(
      laterCustody
        .filter((event) => Boolean(event.holder))
        .map((event) => [normalizeCustodyText(event.holder ?? ''), event.holder ?? ''])
    ).values()
  ).filter(Boolean);

  return {events, latestDesignation, laterCustody, storageLabel, holderNames};
};
