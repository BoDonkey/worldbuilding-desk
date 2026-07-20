import type {
  StateMutationCommand,
  StoredRuleset
} from '../../entityTypes';
import {
  applyStateMutationCommand,
  validateStateMutationCommandAgainstState,
  type CharacterReplayState
} from './stateReplay';
import {
  summarizeStateMutationCommand,
  summarizeStateMutationEffects,
  type StateMutationLabelMaps
} from './stateMutationPresentation';

export type PositionedChangeKind = StateMutationCommand['type'];

export interface PositionedChangeDraft {
  id: string;
  kind: PositionedChangeKind;
  definitionId?: string;
  value?: string;
  name?: string;
  quantity?: string;
}

export interface CompoundChangePreviewStep {
  command: StateMutationCommand;
  summary: string;
  effects: string[];
  issues: string[];
}

export interface CompoundChangePreview {
  after: CharacterReplayState;
  steps: CompoundChangePreviewStep[];
  issues: string[];
}

const numericValue = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildPositionedStateCommand(params: {
  actorId: string;
  draft: PositionedChangeDraft;
  ruleset: StoredRuleset | null;
}): StateMutationCommand | null {
  const actorId = params.actorId.trim();
  if (!actorId) return null;
  const {draft, ruleset} = params;
  const value = numericValue(draft.value);
  const quantity = Math.max(1, Math.floor(numericValue(draft.quantity) ?? 1));
  const name = draft.name?.trim() ?? '';

  switch (draft.kind) {
    case 'stat_change':
    case 'stat_set': {
      const definition = ruleset?.statDefinitions.find(
        (entry) => entry.id === draft.definitionId
      );
      if (!definition || !draft.definitionId) return null;
      const rawValue =
        definition.type === 'number'
          ? value
          : definition.type === 'boolean'
            ? draft.value !== 'false'
            : draft.value ?? '';
      if (rawValue === null || rawValue === '') return null;
      return draft.kind === 'stat_change'
        ? {
            type: 'stat_change',
            actorId,
            statDefinitionId: draft.definitionId,
            delta: rawValue
          }
        : {
            type: 'stat_set',
            actorId,
            statDefinitionId: draft.definitionId,
            value: rawValue
          };
    }
    case 'resource_change':
    case 'resource_set':
      if (
        !draft.definitionId ||
        !ruleset?.resourceDefinitions.some((entry) => entry.id === draft.definitionId) ||
        value === null
      ) {
        return null;
      }
      return draft.kind === 'resource_change'
        ? {
            type: 'resource_change',
            actorId,
            resourceDefinitionId: draft.definitionId,
            delta: value
          }
        : {
            type: 'resource_set',
            actorId,
            resourceDefinitionId: draft.definitionId,
            value
          };
    case 'status_apply':
    case 'status_remove':
      return name ? {type: draft.kind, actorId, statusName: name} : null;
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
      return name ? {type: draft.kind, actorId, itemName: name, quantity} : null;
    case 'inventory_equip':
    case 'inventory_unequip':
      return name ? {type: draft.kind, actorId, itemName: name} : null;
    case 'location_set':
      return name ? {type: 'location_set', actorId, locationName: name} : null;
  }
}

export function buildCompoundChangePreview(params: {
  before: CharacterReplayState;
  commands: StateMutationCommand[];
  labels?: StateMutationLabelMaps;
}): CompoundChangePreview {
  let state = params.before;
  const steps = params.commands.map((command) => {
    const issues = validateStateMutationCommandAgainstState({state, command});
    const after = applyStateMutationCommand(state, command);
    const step = {
      command,
      summary: summarizeStateMutationCommand({command, labels: params.labels}),
      effects: summarizeStateMutationEffects({
        before: state,
        after,
        command,
        labels: params.labels
      }),
      issues
    };
    state = after;
    return step;
  });
  return {
    after: state,
    steps,
    issues: steps.flatMap((step) => step.issues)
  };
}
