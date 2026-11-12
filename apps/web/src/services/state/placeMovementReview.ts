import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import type {KnownEntityRef} from '../consistency';
import {sortWritingDocuments} from '../storage';
import {characterPath, placeReach, type PathStop} from '../worldBible/placeMovement';
import {
  normalizePlaceName,
  placeCandidates,
  type PlaceNameIndex
} from '../worldBible/placePositions';
import {manuscriptPlainText} from './manuscriptCustody';
import type {StateContinuityReviewItem} from './stateContinuityReview';
import {buildStateSubjectLookup, stateSubjectIds, type StateSubject} from './stateSubjects';

/*
 * Movement checks (slice 4.78, places brief § 7). Warnings only.
 *
 * - Teleporting: an accepted move between two place records that no
 *   connection or route links, with no travel cue in the prose between the
 *   two positions. Moves inside a place, and places with no connections
 *   anywhere around them, are not checked.
 * - Unknown place: a recorded position whose name matches no place record,
 *   or several. Names the author kept as text are left out.
 *
 * No story time: how long a journey takes is not checked.
 */

/** Words that tell the reader a character travelled. */
const TRAVEL_CUE = /\b(?:travel(?:l)?ed|travels|journey(?:ed|s)?|rode|rides|sailed|sails|flew|flies|marched|walked|hiked|trekked|set out|sets out|crossed|crosses|headed|heads|left for|leaves for|arrived|arrives|entered|enters|went|goes|returned|returns|moved|moves|(?:days?|weeks?|months?|hours?) later)\b/i;

const sentences = (text: string): Array<{start: number; text: string}> =>
  [...text.matchAll(/[^.!?\n]+[.!?]*/g)].map((match) => ({start: match.index ?? 0, text: match[0]}));

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const subjectNames = (subject: StateSubject, knownEntities: KnownEntityRef[]): string[] => {
  const ids = new Set(stateSubjectIds(subject));
  return [...new Set([
    subject.name,
    ...knownEntities.filter((entity) => ids.has(entity.id)).map((entity) => entity.name)
  ].filter(Boolean))];
};

/**
 * True when a sentence naming the character and a travel word appears after
 * `from` and up to `to` (inclusive, so the sentence that records the move
 * counts as its own cue).
 */
const hasTravelCueBetween = (params: {
  orderedScenes: WritingDocument[];
  names: string[];
  from: PathStop;
  to: PathStop;
}): boolean => {
  const namePattern = new RegExp(`\\b(?:${params.names.map(escapeRegex).join('|')})\\b`, 'i');
  return params.orderedScenes.some((scene, index) => {
    const order = index + 1;
    if (order < params.from.sceneOrder || order > params.to.sceneOrder) return false;
    return sentences(manuscriptPlainText(scene.content)).some((sentence) => {
      if (order === params.from.sceneOrder &&
        sentence.start + sentence.text.length <= (params.from.scenePosition ?? Number.MAX_SAFE_INTEGER)) {
        return false;
      }
      if (order === params.to.sceneOrder && sentence.start > (params.to.scenePosition ?? Number.MAX_SAFE_INTEGER)) {
        return false;
      }
      return namePattern.test(sentence.text) && TRAVEL_CUE.test(sentence.text);
    });
  });
};

/** The sentence in the scene that names the place, nearest the move, to highlight. */
const focusSentence = (scene: WritingDocument, placeName: string, position?: number): string | undefined => {
  const pattern = new RegExp(`\\b${escapeRegex(placeName)}\\b`, 'i');
  const matches = sentences(manuscriptPlainText(scene.content)).filter((sentence) => pattern.test(sentence.text));
  if (matches.length === 0) return undefined;
  const at = position ?? 0;
  return matches
    .sort((a, b) => Math.abs(a.start - at) - Math.abs(b.start - at))[0]
    .text.trim();
};

const makeItem = (params: {
  kind: 'teleport' | 'unknown-place';
  key: string;
  scene: WritingDocument;
  subject: StateSubject;
  message: string;
  focusText?: string;
}): StateContinuityReviewItem => ({
  id: `state:${params.kind}:${params.scene.id}:${params.subject.actorId}:${params.key}`,
  sceneId: params.scene.id,
  sceneTitle: params.scene.title || 'Untitled scene',
  issue: {
    code: 'STATE_CONFLICT',
    placeCheck: params.kind,
    severity: 'warning',
    message: params.message,
    focusText: params.focusText,
    relatedEntities: [{id: params.subject.actorId, name: params.subject.name, type: 'character'}]
  }
});

export function findPlaceMovementReviewItems(params: {
  /** The scenes being reviewed. */
  documents: WritingDocument[];
  /** Every scene, for manuscript order. */
  sceneOrderDocuments: WritingDocument[];
  subjects: StateSubject[];
  knownEntities: KnownEntityRef[];
  events: StateMutationEvent[];
  places: PlaceNameIndex;
  placeNamesKeptAsText?: string[];
  actorResolutions?: ActorResolution[];
}): StateContinuityReviewItem[] {
  const orderedScenes = sortWritingDocuments(params.sceneOrderDocuments);
  const reviewed = new Map(params.documents.map((scene) => [scene.id, scene]));
  const items: StateContinuityReviewItem[] = [];

  params.subjects.forEach((subject) => {
    const stops = characterPath({
      subject,
      subjects: params.subjects,
      events: params.events,
      documents: params.sceneOrderDocuments,
      index: params.places,
      actorResolutions: params.actorResolutions
    });
    stops.forEach((stop, index) => {
      const previous = stops[index - 1];
      const scene = reviewed.get(stop.sceneId);
      if (!previous || !scene || !previous.placeId || !stop.placeId) return;
      if (placeReach(previous.placeId, stop.placeId, params.places.places) !== 'no-route') return;
      if (hasTravelCueBetween({
        orderedScenes,
        names: subjectNames(subject, params.knownEntities),
        from: previous,
        to: stop
      })) return;
      items.push(makeItem({
        kind: 'teleport',
        key: stop.eventId,
        scene,
        subject,
        focusText: focusSentence(scene, stop.label, stop.scenePosition),
        message:
          `${subject.name} moves from ${previous.label} to ${stop.label}, but no connection or route ` +
          'links those places and the prose has no travel cue in between.'
      }));
    });
  });

  const kept = new Set(params.placeNamesKeptAsText ?? []);
  const lookup = buildStateSubjectLookup(params.subjects, params.actorResolutions);
  const seen = new Set<string>();
  params.events
    .filter((event) => event.status !== 'invalidated' && reviewed.has(event.sceneId))
    .forEach((event) => {
      const scene = reviewed.get(event.sceneId) as WritingDocument;
      event.commands.forEach((command) => {
        if (command.type !== 'location_set') return;
        if (command.placeId && params.places.places.has(command.placeId)) return;
        const subject = lookup.get(command.actorId);
        const key = normalizePlaceName(command.locationName);
        if (!subject || !key || kept.has(key)) return;
        const candidates = placeCandidates(key, params.places);
        if (candidates.length === 1) return;
        const item = makeItem({
          kind: 'unknown-place',
          key,
          scene,
          subject,
          focusText: focusSentence(scene, command.locationName.trim(), event.scenePosition),
          message: candidates.length === 0
            ? `${subject.name}'s position "${command.locationName.trim()}" names no place record. ` +
              'Create a place or link it to one in World Bible review.'
            : `${subject.name}'s position "${command.locationName.trim()}" could mean ` +
              `${candidates.length} places. Choose one in World Bible review.`
        });
        if (seen.has(item.id)) return;
        seen.add(item.id);
        items.push(item);
      });
    });

  return items;
}
