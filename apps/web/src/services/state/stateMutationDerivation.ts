import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset
} from '../../entityTypes';
import type {ObservationProposal} from '../worldEngine';
import {
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from './stateReplay';
import {validateStateMutationEvent} from './stateMutationSchemas';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function findSheetForActor(
  actor: string | undefined,
  characterSheets: CharacterSheet[]
): CharacterSheet | null {
  if (!actor) {
    return null;
  }
  const normalizedActor = normalize(actor);
  return (
    characterSheets.find(
      (sheet) =>
        normalize(sheet.id) === normalizedActor ||
        normalize(sheet.characterId ?? '') === normalizedActor ||
        normalize(sheet.name) === normalizedActor
    ) ?? null
  );
}

function observationToCommand(
  observation: Extract<ObservationProposal, {type: 'state_delta_candidate'}>,
  actorId: string
): StateMutationCommand | null {
  switch (observation.operation) {
    case 'location_set':
      return observation.target
        ? {
            type: 'location_set',
            actorId,
            locationName: observation.target
          }
        : null;
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
      return observation.target
        ? {
            type: observation.operation,
            actorId,
            itemName: observation.target,
            quantity:
              typeof observation.amount === 'number' && observation.amount > 0
                ? Math.floor(observation.amount)
                : undefined
          }
        : null;
    case 'inventory_equip':
    case 'inventory_unequip':
      return observation.target
        ? {
            type: observation.operation,
            actorId,
            itemName: observation.target
          }
        : null;
    case 'status_apply':
    case 'status_remove':
      return observation.target
        ? {
            type: observation.operation,
            actorId,
            statusName: observation.target
          }
        : null;
    case 'resource_change':
    case 'resource_set':
    case 'stat_change':
    case 'stat_set':
      return null;
  }
}

export function buildDerivedStateMutationEvents(params: {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  sceneOrder: number;
  sourceRevision: number;
  sourceHash: string;
  observations: ObservationProposal[];
  characterSheets: CharacterSheet[];
  ruleset: StoredRuleset | null;
  existingEvents: StateMutationEvent[];
  createdAt?: number;
}): StateMutationEvent[] {
  const relevantObservations = params.observations.filter(
    (observation): observation is Extract<ObservationProposal, {type: 'state_delta_candidate'}> =>
      observation.type === 'state_delta_candidate'
  );

  const nonGeneratedEvents = params.existingEvents.filter(
    (event) =>
      !(
        event.sceneId === params.sceneId &&
        event.sourceType === 'deterministic-review' &&
        event.status === 'accepted'
      )
  );
  const sceneSequenceStart =
    nonGeneratedEvents
      .filter((event) => event.sceneId === params.sceneId && event.status === 'accepted')
      .reduce((max, event) => Math.max(max, event.sceneSequence ?? 0), 0) + 1;

  const nextEvents: StateMutationEvent[] = [];
  const acceptedPreviewEvents = (): StateMutationEvent[] =>
    nextEvents.map((event) => ({
      ...event,
      status: 'accepted' as const
    }));

  relevantObservations.forEach((observation, index) => {
    const sheet = findSheetForActor(observation.actor, params.characterSheets);
    if (!sheet) {
      return;
    }
    const actorId = sheet.characterId ?? sheet.id;
    const command = observationToCommand(observation, actorId);
    if (!command) {
      return;
    }

    const event: StateMutationEvent = {
      id: crypto.randomUUID(),
      projectId: params.projectId,
      sceneId: params.sceneId,
      sceneTitle: params.sceneTitle,
      sceneOrder: params.sceneOrder,
      sceneSequence: sceneSequenceStart + index,
      sourceType: 'deterministic-review',
      sourceRevision: params.sourceRevision,
      sourceHash: params.sourceHash,
      status: 'proposed',
      commands: [command],
      createdAt: params.createdAt ?? Date.now()
    };

    const stateBefore = replayCharacterState({
      sheet,
      ruleset: params.ruleset,
      events: [...nonGeneratedEvents, ...acceptedPreviewEvents()],
      target: {
        actorId,
        characterId: sheet.characterId,
        sheetId: sheet.id,
        actorName: sheet.name
      },
      upToSceneOrder: params.sceneOrder
    });
    const ruleErrors = validateStateMutationEventForRuleset({
      event,
      ruleset: params.ruleset
    });
    const stateErrors = validateStateMutationCommandAgainstState({
      state: stateBefore,
      command
    });

    if (ruleErrors.length > 0 || stateErrors.length > 0) {
      return;
    }

    validateStateMutationEvent(event);
    nextEvents.push(event);
  });

  return nextEvents;
}
