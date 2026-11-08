import {z} from 'zod';
import type {Effect} from '../../types/Effect';
import type {StateMutationActorId} from '../types';
import type {
  EffectTranslation,
  EngineStateKind,
  EngineStateKindRegistry,
  StateMutationLabelMaps
} from './types';

export type StatChangeStateMutationCommand = {
  type: 'stat_change';
  actorId: StateMutationActorId;
  statDefinitionId: string;
  delta: number | boolean | string;
};

export type StatSetStateMutationCommand = {
  type: 'stat_set';
  actorId: StateMutationActorId;
  statDefinitionId: string;
  value: number | boolean | string;
};

const statValueSchema = z.union([z.number(), z.boolean(), z.string()]);

export const StatChangeStateMutationCommandSchema = z.object({
  type: z.literal('stat_change'),
  actorId: z.string().min(1),
  statDefinitionId: z.string().min(1),
  delta: statValueSchema
});

export const StatSetStateMutationCommandSchema = z.object({
  type: z.literal('stat_set'),
  actorId: z.string().min(1),
  statDefinitionId: z.string().min(1),
  value: statValueSchema
});

export const statCommandSchemas = [
  StatChangeStateMutationCommandSchema,
  StatSetStateMutationCommandSchema
] as const;

type StatCommand = StatChangeStateMutationCommand | StatSetStateMutationCommand;

const statLabel = (id: string, labels?: StateMutationLabelMaps): string =>
  labels?.statDefinitionNameById?.get(id) ?? id;

const statValue = (command: StatCommand): number | boolean | string =>
  command.type === 'stat_change' ? command.delta : command.value;

const validateIds: EngineStateKind<StatCommand>['validateIds'] = (command, ruleset) =>
  ruleset.statDefinitions.some((definition) => definition.id === command.statDefinitionId)
    ? []
    : [`Unknown stat definition "${command.statDefinitionId}".`];

const validateValueTypes: EngineStateKind<StatCommand>['validateValueTypes'] = (
  command,
  ruleset
) => {
  const statDefinition = ruleset.statDefinitions.find(
    (definition) => definition.id === command.statDefinitionId
  );
  if (!statDefinition) {
    return [];
  }
  const fieldValue = statValue(command);
  const actualType =
    typeof fieldValue === 'boolean'
      ? 'boolean'
      : typeof fieldValue === 'number'
        ? 'number'
        : 'text';
  return actualType === statDefinition.type
    ? []
    : [
        `Stat "${statDefinition.id}" expects ${statDefinition.type} but received ${actualType}.`
      ];
};

const summarizeEffects: EngineStateKind<StatCommand>['summarizeEffects'] = ({
  before,
  after,
  command,
  labels
}) => [
  `${statLabel(command.statDefinitionId, labels)}: ${String(before.stats[command.statDefinitionId] ?? 'unset')} -> ${String(
    after.stats[command.statDefinitionId] ?? 'unset'
  )}`
];

export const statKinds = {
  stat_change: {
    apply(next, command) {
      const currentValue = next.stats[command.statDefinitionId];
      if (typeof currentValue === 'number' && typeof command.delta === 'number') {
        next.stats[command.statDefinitionId] = currentValue + command.delta;
      } else {
        next.stats[command.statDefinitionId] = command.delta;
      }
    },
    validateIds,
    validateValueTypes,
    label: (command, labels) =>
      `${statLabel(command.statDefinitionId, labels)} ${typeof command.delta === 'number' && command.delta >= 0 ? '+' : ''}${String(command.delta)}`,
    summarizeEffects
  },
  stat_set: {
    apply(next, command) {
      next.stats[command.statDefinitionId] = command.value;
    },
    validateIds,
    validateValueTypes,
    label: (command, labels) =>
      `${statLabel(command.statDefinitionId, labels)} set to ${String(command.value)}`,
    summarizeEffects
  }
} satisfies Pick<EngineStateKindRegistry, 'stat_change' | 'stat_set'>;

const STAT_TARGET_PREFIX = 'stats.';

/**
 * Translates an engine `Effect` on a stat. Returns null when the target is
 * not a stat. Strings are not translated because the engine may read them
 * as formulas.
 */
export function statCommandFromEffect(
  actorId: string,
  effect: Effect
): EffectTranslation | null {
  if (!effect.target.startsWith(STAT_TARGET_PREFIX)) return null;
  const statDefinitionId = effect.target.slice(STAT_TARGET_PREFIX.length);
  if (!statDefinitionId) return null;
  if (effect.min !== undefined || effect.max !== undefined) {
    return {ok: false, reason: 'Effect limits (min/max) have no ledger equivalent; replay does not clamp stats.'};
  }
  const {value} = effect;
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  switch (effect.operation) {
    case 'set':
      return isNumber || typeof value === 'boolean'
        ? {ok: true, command: {type: 'stat_set', actorId, statDefinitionId, value}}
        : {ok: false, reason: 'Stat set effects need a plain number or true/false; formulas and text are not translated.'};
    case 'add':
    case 'subtract':
      if (!isNumber) {
        return {ok: false, reason: 'Stat add/subtract effects need a plain number; formulas are not translated.'};
      }
      return {
        ok: true,
        command: {
          type: 'stat_change',
          actorId,
          statDefinitionId,
          delta: effect.operation === 'add' ? value : -value
        }
      };
    default:
      return {ok: false, reason: `Operation "${effect.operation}" has no stat state-change kind.`};
  }
}
