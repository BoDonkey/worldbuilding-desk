import {z} from 'zod';
import type {Effect} from '../../types/Effect';
import type {CharacterReplayState, StateMutationCommand} from '../types';
import {inventoryCommandSchemas, inventoryKinds} from './inventory';
import {locationCommandSchemas, locationKinds} from './location';
import {progressionCommandSchemas, progressionKinds} from './progression';
import {resourceCommandFromEffect, resourceCommandSchemas, resourceKinds} from './resource';
import {statCommandFromEffect, statCommandSchemas, statKinds} from './stat';
import {statusCommandSchemas, statusKinds} from './status';
import type {
  EffectTranslation,
  EngineStateKind,
  EngineStateKindRegistry,
  StateMutationCommandType,
  StateMutationLabelMaps
} from './types';

export * from './types';
export {
  ResourceChangeStateMutationCommandSchema,
  ResourceSetStateMutationCommandSchema
} from './resource';
export type {
  ResourceChangeStateMutationCommand,
  ResourceSetStateMutationCommand
} from './resource';
export {
  StatChangeStateMutationCommandSchema,
  StatSetStateMutationCommandSchema
} from './stat';
export type {StatChangeStateMutationCommand, StatSetStateMutationCommand} from './stat';
export {StatusStateMutationCommandSchema} from './status';
export type {StatusStateMutationCommand} from './status';
export {
  InventoryQuantityStateMutationCommandSchema,
  InventoryEquipStateMutationCommandSchema
} from './inventory';
export type {
  InventoryQuantityStateMutationCommand,
  InventoryEquipStateMutationCommand
} from './inventory';
export {LocationSetStateMutationCommandSchema} from './location';
export type {LocationSetStateMutationCommand} from './location';
export {
  XpGainStateMutationCommandSchema,
  deriveLevel,
  normalizeLevelTable
} from './progression';
export type {XpGainStateMutationCommand} from './progression';

/**
 * The state-change kinds, one entry per command `type`. Typed over the whole
 * command union, so a kind without a module entry fails to compile. Adding
 * a kind: see "Adding a state-change kind" in docs/domain-model.md.
 */
export const stateMutationKinds: EngineStateKindRegistry = {
  ...resourceKinds,
  ...statKinds,
  ...statusKinds,
  ...inventoryKinds,
  ...locationKinds,
  ...progressionKinds
};

export const StateMutationCommandSchema = z.discriminatedUnion('type', [
  ...resourceCommandSchemas,
  ...statCommandSchemas,
  ...statusCommandSchemas,
  ...inventoryCommandSchemas,
  ...locationCommandSchemas,
  ...progressionCommandSchemas
]);

type SameTypes<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Compile-time check that the schema union covers exactly the registry's kinds.
void (true satisfies SameTypes<
  StateMutationCommandType,
  z.infer<typeof StateMutationCommandSchema>['type']
>);

/** Every command type, in registry order (form dropdowns, the AI observation enum). */
export const stateMutationCommandTypes = Object.keys(stateMutationKinds) as [
  StateMutationCommandType,
  ...StateMutationCommandType[]
];

/** The kind entry for a command type, for code that handles any command. */
export function getStateMutationKind(
  type: StateMutationCommandType
): EngineStateKind<StateMutationCommand> {
  // Safe: each entry handles exactly the commands whose type is its key.
  return stateMutationKinds[type] as unknown as EngineStateKind<StateMutationCommand>;
}

export function summarizeStateMutationCommand(params: {
  command: StateMutationCommand;
  labels?: StateMutationLabelMaps;
}): string {
  return getStateMutationKind(params.command.type).label(params.command, params.labels);
}

export function summarizeStateMutationEffects(params: {
  before: CharacterReplayState;
  after: CharacterReplayState;
  command: StateMutationCommand;
  labels?: StateMutationLabelMaps;
}): string[] {
  return getStateMutationKind(params.command.type).summarizeEffects(params);
}

/**
 * Turns a rules-engine `Effect` into a ledger command when its target maps
 * cleanly onto a state-change kind. Anything else is reported as not
 * translatable rather than guessed. The caller decides whether the command
 * is proposed or applied.
 */
export function translateEffectToStateMutationCommand(
  actorId: string,
  effect: Effect
): EffectTranslation {
  const translation =
    resourceCommandFromEffect(actorId, effect) ?? statCommandFromEffect(actorId, effect);
  return translation ?? {
    ok: false,
    reason: `No state-change kind for effect target "${effect.target}".`
  };
}
