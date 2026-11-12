import type {
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {compareWritingDocuments} from '../storage';
import type {ActorResolution} from '../characters/characterIdentity';
import type {GuardrailIssue, KnownEntityRef} from '../consistency';
import {extractStateDeltaObservations} from '../worldEngine/stateDeltaObservations';
import {
  analyzeManuscriptCustody,
  manuscriptPlainText,
  normalizeCustodyText
} from './manuscriptCustody';
import {stateDeltaObservationToCommand} from './kinds';
import {isPlaceWithin} from '../worldBible/places';
import {
  matchPlaceId,
  positionLabel,
  type PlaceNameIndex
} from '../worldBible/placePositions';
import {
  compareStateMutationEvents,
  validateStateMutationCommandAgainstState,
  type CharacterReplayState
} from './stateReplay';
import {
  findStateSubject,
  recordableStateSubjects,
  replayStateSubject,
  stateSubjectAccepts,
  stateSubjectIds,
  type StateSubject
} from './stateSubjects';

export interface StateContinuityReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
}

interface StateContinuityReviewInput {
  documents: WritingDocument[];
  sceneOrderDocuments?: WritingDocument[];
  knownEntities: KnownEntityRef[];
  stateSubjects: StateSubject[];
  actorResolutions?: ActorResolution[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  /** Place records, so positions compare by record and containment (slice 4.77). */
  places?: PlaceNameIndex;
}

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveActorId = (
  actorId: string,
  actorResolutions: ActorResolution[] | undefined
): string =>
  actorResolutions?.find((entry) => entry.legacyActorId === actorId)?.entityId ?? actorId;

const commandMatchesSubject = (
  command: StateMutationCommand,
  subject: StateSubject,
  actorResolutions: ActorResolution[] | undefined
): boolean => {
  const actorId = resolveActorId(command.actorId, actorResolutions);
  return stateSubjectIds(subject)
    .map((id) => resolveActorId(id, actorResolutions))
    .includes(actorId);
};

const commandItemName = (command: StateMutationCommand): string | null => {
  switch (command.type) {
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
    case 'inventory_equip':
    case 'inventory_unequip':
      return command.itemName;
    default:
      return null;
  }
};

const inventoryContains = (
  state: CharacterReplayState,
  itemName: string
): boolean => state.inventory.items.some(
  (item) => normalize(item.name) === normalize(itemName) && item.quantity > 0
);

const inventoryEquipped = (
  state: CharacterReplayState,
  itemName: string
): boolean => state.inventory.equipped.some(
  (name) => normalize(name) === normalize(itemName)
);

const eventOrder = (
  event: StateMutationEvent,
  orderBySceneId: Map<string, number>
): number => orderBySceneId.get(event.sceneId) ?? event.sceneOrder ?? Number.MAX_SAFE_INTEGER;

const eventIsBefore = (
  event: StateMutationEvent,
  sceneOrder: number,
  orderBySceneId: Map<string, number>
): boolean => eventOrder(event, orderBySceneId) < sceneOrder;

const latestRelevantEvent = (params: {
  events: StateMutationEvent[];
  subject: StateSubject;
  sceneOrder: number;
  orderBySceneId: Map<string, number>;
  actorResolutions?: ActorResolution[];
  commandMatches: (command: StateMutationCommand) => boolean;
}): StateMutationEvent | null => {
  const candidates = params.events
    .filter((event) => event.status === 'accepted')
    .filter((event) => eventIsBefore(
      event,
      params.sceneOrder,
      params.orderBySceneId
    ))
    .filter((event) => event.commands.some((command) =>
      commandMatchesSubject(command, params.subject, params.actorResolutions) &&
      params.commandMatches(command)
    ));
  return candidates.sort((left, right) => {
    const orderDelta = eventOrder(right, params.orderBySceneId) -
      eventOrder(left, params.orderBySceneId);
    if (orderDelta !== 0) return orderDelta;
    return compareStateMutationEvents(right, left);
  })[0] ?? null;
};

const sourceLabel = (event: StateMutationEvent | null): string =>
  event
    ? `the accepted change in “${event.sceneTitle || 'an earlier scene'}”`
    : 'the character sheet baseline';

const relatedEntity = (subject: StateSubject): GuardrailIssue['relatedEntities'] =>
  [{id: subject.actorId, name: subject.name, type: 'character'}];

const makeItem = (params: {
  code: 'STATE_CONFLICT' | 'INVALID_MUTATION';
  scene: WritingDocument;
  focusText: string;
  message: string;
  subject: StateSubject;
}): StateContinuityReviewItem => ({
  // Sheeted characters keep their sheet id here so earlier dismissals still match.
  id: `state:${params.code}:${params.scene.id}:${params.subject.sheet?.id ?? params.subject.actorId}:${normalize(params.focusText)}`,
  sceneId: params.scene.id,
  sceneTitle: params.scene.title || 'Untitled scene',
  issue: {
    code: params.code,
    severity: 'warning',
    message: params.message,
    focusText: params.focusText,
    relatedEntities: relatedEntity(params.subject)
  }
});

const inventorySubjects = (
  subjects: StateSubject[],
  events: StateMutationEvent[]
): string[] => Array.from(new Map([
  ...subjects.flatMap(({sheet}) => !sheet ? [] : [
    ...(sheet.inventoryEntries ?? []).map((entry) => entry.name),
    ...(sheet.equipmentEntries ?? []).map((entry) => entry.name),
    ...sheet.inventory,
    ...(sheet.equipment ?? [])
  ]),
  ...events.flatMap((event) => event.commands.map(commandItemName).filter(
    (name): name is string => Boolean(name)
  ))
].filter(Boolean).map((name) => [normalize(name), name])).values());

const namesForSubject = (
  subject: StateSubject,
  knownEntities: KnownEntityRef[]
): string[] => {
  const ids = new Set(stateSubjectIds(subject));
  return Array.from(new Set([
    subject.name,
    ...knownEntities.filter((entity) => ids.has(entity.id)).map((entity) => entity.name)
  ].filter(Boolean)));
};

const staticLocationClaims = (
  scene: WritingDocument,
  subject: StateSubject,
  knownEntities: KnownEntityRef[]
): Array<{location: string; start: number; evidence: string}> => {
  const text = manuscriptPlainText(scene.content);
  const claims: Array<{location: string; start: number; evidence: string}> = [];
  namesForSubject(subject, knownEntities).forEach((name) => {
    const pattern = new RegExp(
      `\\b${escapeRegex(name)}\\b\\s+(?:is|was|waited|waits|remained|remains|stood|stays|stayed)\\s+(?:at|in|inside|outside)\\s+(?:the\\s+)?([^.!?,;\\n]+)`,
      'gi'
    );
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        claims.push({
          location: match[1].trim(),
          start: match.index ?? 0,
          evidence: match[0]
        });
      }
    }
  });
  return claims;
};

/**
 * Whether the prose position agrees with the replayed one. When both name a
 * place record, being in a place agrees with being anywhere it is inside or
 * anywhere inside it (tavern and city). Otherwise the names compare as text.
 */
const positionsAgree = (
  state: CharacterReplayState,
  claimedLocation: string,
  places: PlaceNameIndex | undefined
): boolean => {
  if (places && state.locationName) {
    const statePlaceId = state.locationPlaceId && places.places.has(state.locationPlaceId)
      ? state.locationPlaceId
      : matchPlaceId(state.locationName, places);
    const claimPlaceId = matchPlaceId(claimedLocation, places);
    if (statePlaceId && claimPlaceId) {
      return isPlaceWithin(statePlaceId, claimPlaceId, places.places) ||
        isPlaceWithin(claimPlaceId, statePlaceId, places.places);
    }
  }
  return normalize(state.locationName ?? '') === normalize(claimedLocation);
};

const hasMovementCueBetween = (params: {
  orderedScenes: WritingDocument[];
  knownEntities: KnownEntityRef[];
  actorId: string;
  prior: StateMutationEvent;
  currentScene: WritingDocument;
  currentPosition: number;
  orderBySceneId: Map<string, number>;
}): boolean => {
  const priorOrder = eventOrder(params.prior, params.orderBySceneId);
  const currentOrder = params.orderBySceneId.get(params.currentScene.id) ?? Number.MAX_SAFE_INTEGER;
  return params.orderedScenes.some((scene) => {
    const order = params.orderBySceneId.get(scene.id) ?? Number.MAX_SAFE_INTEGER;
    if (order < priorOrder || order > currentOrder) return false;
    return extractStateDeltaObservations({
      projectId: scene.projectId,
      text: manuscriptPlainText(scene.content),
      source: 'workspace-save',
      knownEntities: params.knownEntities
    }).some((observation) =>
      observation.type === 'state_delta_candidate' &&
      observation.actor === params.actorId &&
      observation.operation === 'location_set' &&
      (order > priorOrder || observation.evidence.start > (params.prior.scenePosition ?? -1)) &&
      (order < currentOrder || observation.evidence.start < params.currentPosition)
    );
  });
};

export function findStateContinuityReviewItems({
  documents,
  sceneOrderDocuments = documents,
  knownEntities,
  stateSubjects,
  actorResolutions,
  ruleset,
  stateMutationEvents,
  places
}: StateContinuityReviewInput): StateContinuityReviewItem[] {
  // Sheets need their ruleset; characters without a sheet do not.
  const recordable = recordableStateSubjects(stateSubjects);
  const subjects = ruleset ? recordable : recordable.filter((subject) => !subject.sheet);
  if (subjects.length === 0) return [];
  const orderedScenes = sceneOrderDocuments.slice().sort(compareWritingDocuments);
  const orderBySceneId = new Map(orderedScenes.map((scene, index) => [scene.id, index + 1]));
  const reviewedIds = new Set(documents.map((scene) => scene.id));
  const reviewedScenes = orderedScenes.filter((scene) => reviewedIds.has(scene.id));
  const items: StateContinuityReviewItem[] = [];
  const dedupe = new Set<string>();
  const push = (item: StateContinuityReviewItem) => {
    if (dedupe.has(item.id)) return;
    dedupe.add(item.id);
    items.push(item);
  };

  reviewedScenes.forEach((scene) => {
    const sceneOrder = orderBySceneId.get(scene.id) ?? Number.MAX_SAFE_INTEGER;
    const text = manuscriptPlainText(scene.content);
    const observations = extractStateDeltaObservations({
      projectId: scene.projectId,
      text,
      source: scene.consistencyReviewMode === 'deferred' ? 'import' : 'workspace-save',
      knownEntities
    }).filter((observation) => observation.type === 'state_delta_candidate');

    observations.forEach((observation) => {
      const subject = findStateSubject(observation.actor, subjects);
      if (!subject) return;
      const command = stateDeltaObservationToCommand(observation, subject.actorId);
      if (!command || !stateSubjectAccepts(subject, command)) return;
      const state = replayStateSubject({
        subject,
        ruleset,
        events: stateMutationEvents,
        actorResolutions,
        upToSceneOrder: sceneOrder,
        upToScenePosition: observation.evidence.start - 1
      });
      const errors = validateStateMutationCommandAgainstState({state, command});
      if (errors.length === 0) return;
      const prior = latestRelevantEvent({
        events: stateMutationEvents,
        subject,
        sceneOrder,
        orderBySceneId,
        actorResolutions,
        commandMatches: (candidate) => {
          const itemName = commandItemName(candidate);
          return Boolean(itemName && commandItemName(command) &&
            normalize(itemName) === normalize(commandItemName(command) ?? ''));
        }
      });
      if (!prior) return;
      push(makeItem({
        code: 'INVALID_MUTATION',
        scene,
        focusText: observation.evidence.text,
        subject,
        message:
          `This proposed state change cannot replay for ${subject.name}: ${errors.join(' ')} ` +
          `The conflicting state comes from ${sourceLabel(prior)}.`
      }));
    });

    subjects.forEach((subject) => {
      const actorId = subject.actorId;
      staticLocationClaims(scene, subject, knownEntities).forEach((claim) => {
        const state = replayStateSubject({
          subject,
          ruleset,
          events: stateMutationEvents,
          actorResolutions,
          upToSceneOrder: sceneOrder,
          upToScenePosition: claim.start
        });
        if (!state.locationName || positionsAgree(state, claim.location, places)) return;
        const prior = latestRelevantEvent({
          events: stateMutationEvents,
          subject,
          sceneOrder,
          orderBySceneId,
          actorResolutions,
          commandMatches: (command) => command.type === 'location_set'
        });
        if (!prior) return;
        const interveningMove = hasMovementCueBetween({
          orderedScenes,
          knownEntities,
          actorId,
          prior,
          currentScene: scene,
          currentPosition: claim.start,
          orderBySceneId
        });
        if (interveningMove) return;
        push(makeItem({
          code: 'STATE_CONFLICT',
          scene,
          focusText: claim.evidence,
          subject,
          message:
            `${subject.name} is described at ${claim.location}, but ${sourceLabel(prior)} ` +
            `places them at ${places ? positionLabel(state, places.places) : state.locationName}, ` +
            'with no movement cue in between.'
        }));
      });
    });
  });

  inventorySubjects(subjects, stateMutationEvents).forEach((itemName) => {
    const analysis = analyzeManuscriptCustody(itemName, orderedScenes);
    analysis.events
      .filter((event) => reviewedIds.has(event.scene.id))
      .filter((event) => event.kind === 'held-by' || event.kind === 'used-by')
      .filter((event) => normalize(event.evidence).includes(normalize(itemName)))
      .forEach((event) => {
        const holder = normalizeCustodyText(event.holder ?? '');
        const subject = subjects.find((candidate) =>
          namesForSubject(candidate, knownEntities).some(
            (name) => normalizeCustodyText(name) === holder
          )
        );
        if (!subject) return;
        const sceneOrder = orderBySceneId.get(event.scene.id);
        if (!sceneOrder) return;
        const state = replayStateSubject({
          subject,
          ruleset,
          events: stateMutationEvents,
          actorResolutions,
          upToSceneOrder: sceneOrder,
          upToScenePosition: event.position
        });
        const missing = !inventoryContains(state, itemName);
        const requiresEquipped = /\b(?:attacked|slashed|stabbed|struck|wielded)\b/i.test(event.evidence);
        const unequipped = requiresEquipped && !inventoryEquipped(state, itemName);
        if (!missing && !unequipped) return;
        const prior = latestRelevantEvent({
          events: stateMutationEvents,
          subject,
          sceneOrder,
          orderBySceneId,
          actorResolutions,
          commandMatches: (command) => {
            const name = commandItemName(command);
            return Boolean(name && normalize(name) === normalize(itemName) && (
              command.type === 'inventory_remove' ||
              command.type === 'inventory_consume' ||
              command.type === 'inventory_unequip'
            ));
          }
        });
        if (!prior) return;
        push(makeItem({
          code: 'STATE_CONFLICT',
          scene: event.scene,
          focusText: event.evidence,
          subject,
          message: missing
            ? `${subject.name} uses or holds ${itemName}, but ${sourceLabel(prior)} removed it and no later acquisition is accepted.`
            : `${subject.name} attacks or wields ${itemName}, but ${sourceLabel(prior)} leaves it unequipped.`
        }));
      });
  });

  return items;
}
