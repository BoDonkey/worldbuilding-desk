import {deriveLevel, getStateMutationKind, normalizeLevelTable} from './kinds';
import type {
  ActorResolutionReference,
  CharacterReplayState,
  CharacterStateReplayBaseline,
  ManuscriptRuleset,
  ReplayableCharacterTarget,
  ReplaySheet,
  StateMutationCommand,
  StateMutationEvent
} from './types';

function resolveActorId(
  actorId: string,
  actorResolutions: ActorResolutionReference[] | undefined
): string {
  return (
    actorResolutions?.find((resolution) => resolution.legacyActorId === actorId)
      ?.entityId ?? actorId
  );
}

export function compareStateMutationEvents(a: StateMutationEvent, b: StateMutationEvent): number {
  const orderDelta =
    (a.sceneOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.sceneOrder ?? Number.MAX_SAFE_INTEGER);
  if (orderDelta !== 0) return orderDelta;
  if (a.sceneId === b.sceneId) {
    const positionDelta =
      (a.scenePosition ?? Number.MAX_SAFE_INTEGER) -
      (b.scenePosition ?? Number.MAX_SAFE_INTEGER);
    if (positionDelta !== 0) return positionDelta;
    const sequenceDelta =
      (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
      (b.sceneSequence ?? Number.MAX_SAFE_INTEGER);
    if (sequenceDelta !== 0) return sequenceDelta;
  }
  if (a.sourceRevision !== b.sourceRevision) {
    return a.sourceRevision - b.sourceRevision;
  }
  return a.createdAt - b.createdAt;
}

export function getAcceptedStateMutationEvents(events: StateMutationEvent[]): StateMutationEvent[] {
  return events
    .filter((event) => event.status === 'accepted')
    .slice()
    .sort(compareStateMutationEvents);
}

export function buildCharacterReplayBaseline(params: {
  sheet: ReplaySheet;
  ruleset: ManuscriptRuleset | null;
}): CharacterStateReplayBaseline {
  const {sheet, ruleset} = params;

  const stats: Record<string, number | boolean | string> = {};
  const current: Record<string, number> = {};
  const max: Record<string, number> = {};

  ruleset?.statDefinitions.forEach((definition) => {
    stats[definition.id] = definition.defaultValue;
  });
  ruleset?.resourceDefinitions.forEach((definition) => {
    const currentValue =
      typeof definition.defaultValue === 'number' ? definition.defaultValue : 0;
    current[definition.id] = currentValue;
    max[definition.id] =
      typeof definition.max === 'number' ? definition.max : currentValue;
  });

  sheet.stats.forEach((stat) => {
    stats[stat.definitionId] = stat.value;
  });

  sheet.resources.forEach((resource) => {
    current[resource.definitionId] = resource.current;
    max[resource.definitionId] = resource.max;
  });

  const inventoryItems =
    sheet.inventoryEntries?.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity ?? 1,
      sourceEntityId: entry.sourceEntityId,
      definitionId: entry.definitionId
    })) ?? [];
  const equipped = sheet.equipmentEntries?.map((entry) => entry.name) ?? [];
  const statuses =
    sheet.statusEntries?.map((entry) => entry.name) ??
    sheet.statuses?.filter(Boolean) ??
    [];

  const startingProgression = {
    experience: sheet.experience ?? 0,
    startingLevel: sheet.level ?? 1,
    levelTable: normalizeLevelTable(ruleset?.levelTable)
  };

  return {
    actorId: sheet.characterEntityId ?? sheet.characterId ?? sheet.id,
    actorName: sheet.name,
    stats,
    resources: {
      current,
      max
    },
    inventory: {
      items: inventoryItems,
      equipped
    },
    statuses,
    locationName: undefined,
    locationPlaceId: undefined,
    progression: {...startingProgression, level: deriveLevel(startingProgression)}
  };
}

function matchesActor(
  commandActorId: string,
  target: ReplayableCharacterTarget,
  actorResolutions: ActorResolutionReference[] | undefined
): boolean {
  const resolvedCommandActorId = resolveActorId(commandActorId, actorResolutions);
  return [
    target.actorId,
    target.characterId,
    target.sheetId
  ]
    .filter(Boolean)
    .map((actorId) => resolveActorId(actorId as string, actorResolutions))
    .includes(resolvedCommandActorId);
}

export function applyStateMutationCommand(
  state: CharacterReplayState,
  command: StateMutationCommand
): CharacterReplayState {
  const next: CharacterReplayState = {
    actorId: state.actorId,
    actorName: state.actorName,
    stats: {...state.stats},
    resources: {
      current: {...state.resources.current},
      max: {...state.resources.max}
    },
    inventory: {
      items: state.inventory.items.map((item) => ({...item})),
      equipped: [...state.inventory.equipped]
    },
    statuses: [...state.statuses],
    locationName: state.locationName,
    locationPlaceId: state.locationPlaceId,
    // The level table is never changed by replay, so it is shared.
    progression: {...state.progression}
  };

  getStateMutationKind(command.type).apply(next, command);
  return next;
}

export function validateStateMutationCommandAgainstState(params: {
  state: CharacterReplayState;
  command: StateMutationCommand;
}): string[] {
  return (
    getStateMutationKind(params.command.type).validateAgainstState?.(
      params.state,
      params.command
    ) ?? []
  );
}

export function replayCharacterState(params: {
  sheet: ReplaySheet;
  ruleset: ManuscriptRuleset | null;
  events: StateMutationEvent[];
  target: ReplayableCharacterTarget;
  actorResolutions?: ActorResolutionReference[];
  upToSceneOrder?: number;
  upToScenePosition?: number;
}): CharacterReplayState {
  const baseline = buildCharacterReplayBaseline({
    sheet: params.sheet,
    ruleset: params.ruleset
  });

  let state: CharacterReplayState = {
    actorId: baseline.actorId,
    actorName: baseline.actorName,
    stats: {...baseline.stats},
    resources: {
      current: {...baseline.resources.current},
      max: {...baseline.resources.max}
    },
    inventory: {
      items: baseline.inventory.items.map((item) => ({...item})),
      equipped: [...baseline.inventory.equipped]
    },
    statuses: [...baseline.statuses],
    locationName: baseline.locationName,
    locationPlaceId: baseline.locationPlaceId,
    progression: {...baseline.progression}
  };

  const acceptedEvents = getAcceptedStateMutationEvents(params.events);
  for (const event of acceptedEvents) {
    const eventSceneOrder = event.sceneOrder ?? Number.MAX_SAFE_INTEGER;
    if (
      typeof params.upToSceneOrder === 'number' &&
      eventSceneOrder > params.upToSceneOrder
    ) {
      break;
    }
    if (
      typeof params.upToSceneOrder === 'number' &&
      typeof params.upToScenePosition === 'number' &&
      eventSceneOrder === params.upToSceneOrder &&
      (event.scenePosition === undefined || event.scenePosition > params.upToScenePosition)
    ) {
      continue;
    }
    for (const command of event.commands) {
      if (matchesActor(command.actorId, params.target, params.actorResolutions)) {
        state = applyStateMutationCommand(state, command);
      }
    }
  }

  return state;
}
