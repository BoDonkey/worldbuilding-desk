import {z} from 'zod';
import type {Effect} from '../../types/Effect';
import type {CharacterReplayState, StateMutationActorId} from '../types';
import type {
  EffectTranslation,
  EngineStateKind,
  EngineStateKindRegistry,
  StateMutationLabelMaps
} from './types';

export type ResourceChangeStateMutationCommand = {
  type: 'resource_change';
  actorId: StateMutationActorId;
  resourceDefinitionId: string;
  delta: number;
};

export type ResourceSetStateMutationCommand = {
  type: 'resource_set';
  actorId: StateMutationActorId;
  resourceDefinitionId: string;
  value: number;
};

export const ResourceChangeStateMutationCommandSchema = z.object({
  type: z.literal('resource_change'),
  actorId: z.string().min(1),
  resourceDefinitionId: z.string().min(1),
  delta: z.number()
});

export const ResourceSetStateMutationCommandSchema = z.object({
  type: z.literal('resource_set'),
  actorId: z.string().min(1),
  resourceDefinitionId: z.string().min(1),
  value: z.number()
});

export const resourceCommandSchemas = [
  ResourceChangeStateMutationCommandSchema,
  ResourceSetStateMutationCommandSchema
] as const;

type ResourceCommand = ResourceChangeStateMutationCommand | ResourceSetStateMutationCommand;

const clampMinZero = (value: number): number => (value < 0 ? 0 : value);

/** Resources stay between zero and their max. */
function setClamped(next: CharacterReplayState, resourceId: string, value: number): void {
  const maxValue = next.resources.max[resourceId];
  next.resources.current[resourceId] =
    typeof maxValue === 'number'
      ? Math.min(clampMinZero(value), maxValue)
      : clampMinZero(value);
}

const resourceLabel = (id: string, labels?: StateMutationLabelMaps): string =>
  labels?.resourceDefinitionNameById?.get(id) ?? id;

const validateIds: EngineStateKind<ResourceCommand>['validateIds'] = (command, ruleset) =>
  ruleset.resourceDefinitions.some((definition) => definition.id === command.resourceDefinitionId)
    ? []
    : [`Unknown resource definition "${command.resourceDefinitionId}".`];

const summarizeEffects: EngineStateKind<ResourceCommand>['summarizeEffects'] = ({
  before,
  after,
  command,
  labels
}) => {
  const label = resourceLabel(command.resourceDefinitionId, labels);
  const beforeValue = before.resources.current[command.resourceDefinitionId] ?? 0;
  const afterValue = after.resources.current[command.resourceDefinitionId] ?? 0;
  return [`${label}: ${beforeValue} -> ${afterValue}`];
};

export const resourceKinds = {
  resource_change: {
    apply(next, command) {
      const currentValue = next.resources.current[command.resourceDefinitionId] ?? 0;
      setClamped(next, command.resourceDefinitionId, currentValue + command.delta);
    },
    validateAgainstState(state, command) {
      const currentValue = state.resources.current[command.resourceDefinitionId] ?? 0;
      const nextValue = currentValue + command.delta;
      return nextValue < 0
        ? [
            `Resource "${command.resourceDefinitionId}" would drop below zero (${currentValue} + ${command.delta}).`
          ]
        : [];
    },
    validateIds,
    label: (command, labels) =>
      `${resourceLabel(command.resourceDefinitionId, labels)} ${command.delta >= 0 ? '+' : ''}${command.delta}`,
    summarizeEffects
  },
  resource_set: {
    apply(next, command) {
      setClamped(next, command.resourceDefinitionId, command.value);
    },
    validateAgainstState: (_state, command) =>
      command.value < 0
        ? [`Resource "${command.resourceDefinitionId}" cannot be set below zero.`]
        : [],
    validateIds,
    label: (command, labels) =>
      `${resourceLabel(command.resourceDefinitionId, labels)} set to ${command.value}`,
    summarizeEffects
  }
} satisfies Pick<EngineStateKindRegistry, 'resource_change' | 'resource_set'>;

const RESOURCE_TARGET_PREFIX = 'resources.current.';

/**
 * Translates an engine `Effect` on a resource's current value. Returns null
 * when the target is not a resource's current value.
 */
export function resourceCommandFromEffect(
  actorId: string,
  effect: Effect
): EffectTranslation | null {
  if (!effect.target.startsWith(RESOURCE_TARGET_PREFIX)) return null;
  const resourceDefinitionId = effect.target.slice(RESOURCE_TARGET_PREFIX.length);
  if (!resourceDefinitionId) return null;
  if (effect.min !== undefined || effect.max !== undefined) {
    return {ok: false, reason: 'Effect limits (min/max) have no ledger equivalent; replay applies its own resource limits.'};
  }
  if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
    return {ok: false, reason: 'Resource effects need a plain number; formulas and other values are not translated.'};
  }
  switch (effect.operation) {
    case 'set':
      return {ok: true, command: {type: 'resource_set', actorId, resourceDefinitionId, value: effect.value}};
    case 'add':
      return {ok: true, command: {type: 'resource_change', actorId, resourceDefinitionId, delta: effect.value}};
    case 'subtract':
      return {ok: true, command: {type: 'resource_change', actorId, resourceDefinitionId, delta: -effect.value}};
    default:
      return {ok: false, reason: `Operation "${effect.operation}" has no resource state-change kind.`};
  }
}
