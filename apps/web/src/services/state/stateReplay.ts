import type {CharacterSheet, StateMutationCommand, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {getStateMutationEventsByProject} from './stateMutationLedger';
import {
  buildCharacterReplayBaseline,
  validateStateMutationCommandIds,
  validateStateMutationCommandValueTypes
} from './stateMutationSchemas';

export interface CharacterReplayState {
  actorId: string;
  actorName: string;
  stats: Record<string, number | boolean | string>;
  resources: {
    current: Record<string, number>;
    max: Record<string, number>;
  };
  inventory: {
    items: Array<{name: string; quantity: number}>;
    equipped: string[];
  };
  statuses: string[];
  locationName?: string;
}

export interface ReplayableCharacterTarget {
  characterId?: string;
  sheetId?: string;
  actorId?: string;
  actorName?: string;
}

export function compareStateMutationEvents(a: StateMutationEvent, b: StateMutationEvent): number {
  const orderDelta =
    (a.sceneOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.sceneOrder ?? Number.MAX_SAFE_INTEGER);
  if (orderDelta !== 0) return orderDelta;
  if (a.sceneId === b.sceneId) {
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

export async function getAcceptedStateMutationEventsByProject(
  projectId: string
): Promise<StateMutationEvent[]> {
  const events = await getStateMutationEventsByProject(projectId);
  return getAcceptedStateMutationEvents(events);
}

function matchesActor(commandActorId: string, target: ReplayableCharacterTarget): boolean {
  return [
    target.actorId,
    target.characterId,
    target.sheetId
  ].filter(Boolean).includes(commandActorId);
}

function clampMinZero(value: number): number {
  return value < 0 ? 0 : value;
}

function findInventoryItemIndex(
  items: CharacterReplayState['inventory']['items'],
  itemName: string
): number {
  return items.findIndex(
    (item) => item.name.trim().toLowerCase() === itemName.trim().toLowerCase()
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
      const existingIndex = findInventoryItemIndex(next.inventory.items, command.itemName);
      const quantity = command.quantity ?? 1;
      if (existingIndex >= 0) {
        next.inventory.items[existingIndex].quantity += quantity;
      } else {
        next.inventory.items.push({name: command.itemName, quantity});
      }
      return next;
    }
    case 'inventory_remove':
    case 'inventory_consume': {
      const existingIndex = findInventoryItemIndex(next.inventory.items, command.itemName);
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
      const existing = state.inventory.items.find(
        (item) => item.name.trim().toLowerCase() === command.itemName.trim().toLowerCase()
      );
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
      const existing = state.inventory.items.find(
        (item) => item.name.trim().toLowerCase() === command.itemName.trim().toLowerCase()
      );
      return existing ? [] : [`Item "${command.itemName}" is not present in inventory.`];
    }
    default:
      return [];
  }
}

export function replayCharacterState(params: {
  sheet: CharacterSheet;
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  target: ReplayableCharacterTarget;
  upToSceneOrder?: number;
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
    if (
      typeof params.upToSceneOrder === 'number' &&
      (event.sceneOrder ?? Number.MAX_SAFE_INTEGER) > params.upToSceneOrder
    ) {
      break;
    }
    for (const command of event.commands) {
      if (matchesActor(command.actorId, params.target)) {
        state = applyStateMutationCommand(state, command);
      }
    }
  }

  return state;
}

export function validateStateMutationEventForRuleset(params: {
  event: StateMutationEvent;
  ruleset: StoredRuleset | null;
}): string[] {
  const errors: string[] = [];
  for (const command of params.event.commands) {
    errors.push(...validateStateMutationCommandIds({
      command,
      ruleset: params.ruleset
    }));
    errors.push(...validateStateMutationCommandValueTypes({
      command,
      ruleset: params.ruleset
    }));
  }
  return errors;
}
