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
    locationName: undefined
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

function clampMinZero(value: number): number {
  return value < 0 ? 0 : value;
}

function findInventoryItemIndex(
  items: CharacterReplayState['inventory']['items'],
  reference: {itemName: string; sourceEntityId?: string; definitionId?: string}
): number {
  if (reference.definitionId) {
    const definitionMatch = items.findIndex(
      (item) => item.definitionId === reference.definitionId
    );
    if (definitionMatch >= 0) return definitionMatch;
  }
  if (reference.sourceEntityId) {
    const entityMatch = items.findIndex(
      (item) => item.sourceEntityId === reference.sourceEntityId
    );
    if (entityMatch >= 0) return entityMatch;
  }
  return items.findIndex((item) =>
    item.name.trim().toLowerCase() === reference.itemName.trim().toLowerCase()
  );
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
    locationName: state.locationName
  };

  switch (command.type) {
    case 'resource_change': {
      const currentValue = next.resources.current[command.resourceDefinitionId] ?? 0;
      const maxValue = next.resources.max[command.resourceDefinitionId];
      const updatedValue = currentValue + command.delta;
      next.resources.current[command.resourceDefinitionId] =
        typeof maxValue === 'number'
          ? Math.min(clampMinZero(updatedValue), maxValue)
          : clampMinZero(updatedValue);
      return next;
    }
    case 'resource_set': {
      const maxValue = next.resources.max[command.resourceDefinitionId];
      next.resources.current[command.resourceDefinitionId] =
        typeof maxValue === 'number'
          ? Math.min(clampMinZero(command.value), maxValue)
          : clampMinZero(command.value);
      return next;
    }
    case 'stat_change': {
      const currentValue = next.stats[command.statDefinitionId];
      if (typeof currentValue === 'number' && typeof command.delta === 'number') {
        next.stats[command.statDefinitionId] = currentValue + command.delta;
      } else {
        next.stats[command.statDefinitionId] = command.delta;
      }
      return next;
    }
    case 'stat_set':
      next.stats[command.statDefinitionId] = command.value;
      return next;
    case 'status_apply':
      if (!next.statuses.includes(command.statusName)) {
        next.statuses.push(command.statusName);
      }
      return next;
    case 'status_remove':
      next.statuses = next.statuses.filter((status) => status !== command.statusName);
      return next;
    case 'inventory_add': {
      const existingIndex = findInventoryItemIndex(next.inventory.items, command);
      const quantity = command.quantity ?? 1;
      if (existingIndex >= 0) {
        next.inventory.items[existingIndex].quantity += quantity;
        next.inventory.items[existingIndex].sourceEntityId ??= command.sourceEntityId;
        next.inventory.items[existingIndex].definitionId ??= command.definitionId;
      } else {
        next.inventory.items.push({
          name: command.itemName,
          quantity,
          sourceEntityId: command.sourceEntityId,
          definitionId: command.definitionId
        });
      }
      return next;
    }
    case 'inventory_remove':
    case 'inventory_consume': {
      const existingIndex = findInventoryItemIndex(next.inventory.items, command);
      if (existingIndex < 0) {
        return next;
      }
      const quantity = command.quantity ?? 1;
      const remaining = next.inventory.items[existingIndex].quantity - quantity;
      if (remaining > 0) {
        next.inventory.items[existingIndex].quantity = remaining;
      } else {
        next.inventory.items.splice(existingIndex, 1);
      }
      if (command.type === 'inventory_remove') {
        next.inventory.equipped = next.inventory.equipped.filter(
          (name) => name !== command.itemName
        );
      }
      return next;
    }
    case 'inventory_equip':
      if (!next.inventory.equipped.includes(command.itemName)) {
        next.inventory.equipped.push(command.itemName);
      }
      return next;
    case 'inventory_unequip':
      next.inventory.equipped = next.inventory.equipped.filter(
        (name) => name !== command.itemName
      );
      return next;
    case 'location_set':
      next.locationName = command.locationName;
      return next;
  }
}

export function validateStateMutationCommandAgainstState(params: {
  state: CharacterReplayState;
  command: StateMutationCommand;
}): string[] {
  const {state, command} = params;

  switch (command.type) {
    case 'resource_change': {
      const currentValue = state.resources.current[command.resourceDefinitionId] ?? 0;
      const nextValue = currentValue + command.delta;
      if (nextValue < 0) {
        return [
          `Resource "${command.resourceDefinitionId}" would drop below zero (${currentValue} + ${command.delta}).`
        ];
      }
      return [];
    }
    case 'resource_set':
      return command.value < 0
        ? [`Resource "${command.resourceDefinitionId}" cannot be set below zero.`]
        : [];
    case 'inventory_remove':
    case 'inventory_consume': {
      const existingIndex = findInventoryItemIndex(state.inventory.items, command);
      const existing = existingIndex >= 0 ? state.inventory.items[existingIndex] : undefined;
      const quantity = command.quantity ?? 1;
      if (!existing) {
        return [`Item "${command.itemName}" is not present in inventory.`];
      }
      if (existing.quantity < quantity) {
        return [
          `Item "${command.itemName}" only has quantity ${existing.quantity}, cannot remove ${quantity}.`
        ];
      }
      return [];
    }
    case 'inventory_equip': {
      const existingIndex = findInventoryItemIndex(state.inventory.items, command);
      const existing = existingIndex >= 0 ? state.inventory.items[existingIndex] : undefined;
      return existing ? [] : [`Item "${command.itemName}" is not present in inventory.`];
    }
    default:
      return [];
  }
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
    locationName: baseline.locationName
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
