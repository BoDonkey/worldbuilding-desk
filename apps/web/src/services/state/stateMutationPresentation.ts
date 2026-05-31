import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset
} from '../../entityTypes';
import {
  applyStateMutationCommand,
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  type CharacterReplayState,
  type ReplayableCharacterTarget
} from './stateReplay';

export interface StateMutationLabelMaps {
  resourceDefinitionNameById?: Map<string, string>;
  statDefinitionNameById?: Map<string, string>;
}

export interface StateMutationPreview {
  before: CharacterReplayState;
  after: CharacterReplayState;
  command: StateMutationCommand;
  validationIssues: string[];
  summaryLine: string;
  effectLines: string[];
}

export function describeStateMutationAcceptance(params: {
  canAccept: boolean;
  canAcceptInBatch: boolean;
  validationIssues: string[];
}): string | null {
  if (params.canAccept) {
    return null;
  }
  if (params.canAcceptInBatch) {
    return 'Becomes valid if you accept earlier suggested changes in this scene first.';
  }
  if (params.validationIssues.length > 0) {
    return 'Still blocked after earlier scene steps. Review the issue below before accepting.';
  }
  return 'This suggested change is not ready to accept yet.';
}

function getSheetByActorId(characterSheets: CharacterSheet[]): Map<string, CharacterSheet> {
  const map = new Map<string, CharacterSheet>();
  characterSheets.forEach((sheet) => {
    map.set(sheet.id, sheet);
    if (sheet.characterId) {
      map.set(sheet.characterId, sheet);
    }
  });
  return map;
}

function findInventoryQuantity(
  state: CharacterReplayState,
  itemName: string
): number {
  return (
    state.inventory.items.find(
      (item) => item.name.trim().toLowerCase() === itemName.trim().toLowerCase()
    )?.quantity ?? 0
  );
}

export function summarizeStateMutationCommand(params: {
  command: StateMutationCommand;
  labels?: StateMutationLabelMaps;
}): string {
  const {command, labels} = params;
  const resourceLabels = labels?.resourceDefinitionNameById;
  const statLabels = labels?.statDefinitionNameById;

  switch (command.type) {
    case 'resource_change': {
      const label = resourceLabels?.get(command.resourceDefinitionId) ?? command.resourceDefinitionId;
      return `${label} ${command.delta >= 0 ? '+' : ''}${command.delta}`;
    }
    case 'resource_set': {
      const label = resourceLabels?.get(command.resourceDefinitionId) ?? command.resourceDefinitionId;
      return `${label} set to ${command.value}`;
    }
    case 'stat_change': {
      const label = statLabels?.get(command.statDefinitionId) ?? command.statDefinitionId;
      return `${label} change ${String(command.delta)}`;
    }
    case 'stat_set': {
      const label = statLabels?.get(command.statDefinitionId) ?? command.statDefinitionId;
      return `${label} set to ${String(command.value)}`;
    }
    case 'status_apply':
      return `Apply status ${command.statusName}`;
    case 'status_remove':
      return `Remove status ${command.statusName}`;
    case 'inventory_add':
      return `Add ${command.itemName} x${command.quantity ?? 1}`;
    case 'inventory_remove':
      return `Remove ${command.itemName} x${command.quantity ?? 1}`;
    case 'inventory_consume':
      return `Consume ${command.itemName} x${command.quantity ?? 1}`;
    case 'inventory_equip':
      return `Equip ${command.itemName}`;
    case 'inventory_unequip':
      return `Unequip ${command.itemName}`;
    case 'location_set':
      return `Move to ${command.locationName}`;
  }
}

export function summarizeStateMutationEffects(params: {
  before: CharacterReplayState;
  after: CharacterReplayState;
  command: StateMutationCommand;
  labels?: StateMutationLabelMaps;
}): string[] {
  const {before, after, command, labels} = params;
  const resourceLabels = labels?.resourceDefinitionNameById;
  const statLabels = labels?.statDefinitionNameById;

  switch (command.type) {
    case 'resource_change':
    case 'resource_set': {
      const label = resourceLabels?.get(command.resourceDefinitionId) ?? command.resourceDefinitionId;
      const beforeValue = before.resources.current[command.resourceDefinitionId] ?? 0;
      const afterValue = after.resources.current[command.resourceDefinitionId] ?? 0;
      return [`${label}: ${beforeValue} -> ${afterValue}`];
    }
    case 'stat_change':
    case 'stat_set': {
      const label = statLabels?.get(command.statDefinitionId) ?? command.statDefinitionId;
      return [
        `${label}: ${String(before.stats[command.statDefinitionId] ?? 'unset')} -> ${String(
          after.stats[command.statDefinitionId] ?? 'unset'
        )}`
      ];
    }
    case 'status_apply':
    case 'status_remove':
      return [`Statuses: ${after.statuses.join(', ') || 'none'}`];
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
      return [`${command.itemName}: ${findInventoryQuantity(before, command.itemName)} -> ${findInventoryQuantity(after, command.itemName)}`];
    case 'inventory_equip':
    case 'inventory_unequip':
      return [
        `${command.itemName}: ${
          after.inventory.equipped.includes(command.itemName) ? 'equipped' : 'unequipped'
        }`
      ];
    case 'location_set':
      return [
        `Location: ${before.locationName || 'unset'} -> ${after.locationName || 'unset'}`
      ];
  }
}

export function buildStateMutationPreview(params: {
  sheet: CharacterSheet;
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  target: ReplayableCharacterTarget;
  command: StateMutationCommand;
  upToSceneOrder?: number;
  labels?: StateMutationLabelMaps;
}): StateMutationPreview {
  const before = replayCharacterState({
    sheet: params.sheet,
    ruleset: params.ruleset,
    events: params.events,
    target: params.target,
    upToSceneOrder: params.upToSceneOrder
  });
  const after = applyStateMutationCommand(before, params.command);
  return {
    before,
    after,
    command: params.command,
    validationIssues: validateStateMutationCommandAgainstState({
      state: before,
      command: params.command
    }),
    summaryLine: summarizeStateMutationCommand({
      command: params.command,
      labels: params.labels
    }),
    effectLines: summarizeStateMutationEffects({
      before,
      after,
      command: params.command,
      labels: params.labels
    })
  };
}

export function computeBatchAcceptableStateMutationEventIds(params: {
  proposedEvents: StateMutationEvent[];
  acceptedEvents: StateMutationEvent[];
  characterSheets: CharacterSheet[];
  ruleset: StoredRuleset | null;
  labels?: StateMutationLabelMaps;
}): Set<string> {
  const batchAcceptableIds = new Set<string>();
  const sheetByActorId = getSheetByActorId(params.characterSheets);
  const proposedEventsBySceneId = new Map(
    params.proposedEvents
      .reduce<Array<[string, StateMutationEvent[]]>>((entries, event) => {
        const existing = entries.find(([sceneId]) => sceneId === event.sceneId);
        if (existing) {
          existing[1].push(event);
        } else {
          entries.push([event.sceneId, [event]]);
        }
        return entries;
      }, [])
      .map(([sceneId, events]) => [
        sceneId,
        events.slice().sort(
          (a, b) =>
            (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
            (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
        )
      ])
  );

  proposedEventsBySceneId.forEach((sceneEvents) => {
    const workingAccepted = [...params.acceptedEvents];
    sceneEvents.forEach((event) => {
      const primaryCommand = event.commands[0];
      const sheet = primaryCommand ? sheetByActorId.get(primaryCommand.actorId) ?? null : null;
      if (!sheet || !primaryCommand) {
        return;
      }
      const preview = buildStateMutationPreview({
        sheet,
        ruleset: params.ruleset,
        events: workingAccepted,
        target: {
          actorId: primaryCommand.actorId,
          characterId: sheet.characterId,
          sheetId: sheet.id,
          actorName: sheet.name
        },
        command: primaryCommand,
        upToSceneOrder: event.sceneOrder ?? Number.MAX_SAFE_INTEGER,
        labels: params.labels
      });
      if (preview.validationIssues.length > 0) {
        return;
      }
      batchAcceptableIds.add(event.id);
      workingAccepted.push({
        ...event,
        status: 'accepted'
      });
    });
  });

  return batchAcceptableIds;
}
