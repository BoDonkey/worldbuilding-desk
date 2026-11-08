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
import {getAppStateKind, type PositionedChangeDraft} from './kinds';

export type PositionedChangeKind = StateMutationCommand['type'];
export type {PositionedChangeDraft};

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
  return getAppStateKind(draft.kind).composer.build({
    actorId,
    draft,
    ruleset,
    value: numericValue(draft.value),
    quantity: Math.max(1, Math.floor(numericValue(draft.quantity) ?? 1)),
    name: draft.name?.trim() ?? ''
  });
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
