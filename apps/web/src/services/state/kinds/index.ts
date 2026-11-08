import type {
  CompendiumConsumableEffect,
  StateMutationCommand
} from '../../../entityTypes';
import {inventoryAppKinds} from './inventory';
import {locationAppKinds} from './location';
import {resourceAppKinds, resourceChangeFromConsumableEffect} from './resource';
import {statAppKinds, statChangeFromConsumableEffect} from './stat';
import {statusAppKinds} from './status';
import type {
  AppStateKind,
  AppStateKindRegistry,
  StateDeltaObservation
} from './types';

export * from './types';

/**
 * The app's side of each state-change kind (the engine's side is
 * `stateMutationKinds` in the rules engine). Typed over the whole command
 * union, so a kind without an entry fails to compile.
 */
export const appStateKinds: AppStateKindRegistry = {
  ...resourceAppKinds,
  ...statAppKinds,
  ...statusAppKinds,
  ...inventoryAppKinds,
  ...locationAppKinds
};

/** The app entry for a command type, for code that handles any command. */
export function getAppStateKind(
  type: StateMutationCommand['type']
): AppStateKind<StateMutationCommand> {
  // Safe: each entry handles exactly the commands whose type is its key.
  return appStateKinds[type] as unknown as AppStateKind<StateMutationCommand>;
}

export function stateDeltaObservationToCommand(
  observation: StateDeltaObservation,
  actorId: string
): StateMutationCommand | null {
  return getAppStateKind(observation.operation).fromObservation(observation, actorId);
}

export function summarizeMutationCommand(command: StateMutationCommand): string {
  return getAppStateKind(command.type).historyLabel(command);
}

const consumableEffectCommands: {
  [T in CompendiumConsumableEffect['type']]: (params: {
    actorId: string;
    definitionId: string;
    delta: number;
  }) => StateMutationCommand;
} = {
  stat_change: statChangeFromConsumableEffect,
  resource_change: resourceChangeFromConsumableEffect
};

/** A Compendium consumable effect as a ledger command; `reverse` undoes it. */
export function consumableEffectToCommand(params: {
  actorId: string;
  effect: CompendiumConsumableEffect;
  reverse?: boolean;
}): StateMutationCommand {
  const {actorId, effect, reverse} = params;
  return consumableEffectCommands[effect.type]({
    actorId,
    definitionId: effect.definitionId,
    delta: reverse ? -effect.delta : effect.delta
  });
}
