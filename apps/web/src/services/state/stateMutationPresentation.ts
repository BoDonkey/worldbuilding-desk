import type {
  CharacterSheet,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset
} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {
  applyStateMutationCommand,
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  type CharacterReplayState,
  type ReplayableCharacterTarget
} from './stateReplay';
import {
  summarizeStateMutationCommand,
  summarizeStateMutationEffects,
  type StateMutationLabelMaps
} from '@worldbuilding-desk/rules-engine';

// Each kind's label and before/after summary live with its module in the
// rules engine (Slice 3.34); this module keeps the app's import path.
export {summarizeStateMutationCommand, summarizeStateMutationEffects};
export type {StateMutationLabelMaps};

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
    if (sheet.characterEntityId) {
      map.set(sheet.characterEntityId, sheet);
    }
  });
  return map;
}

export function buildStateMutationPreview(params: {
  sheet: CharacterSheet;
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  target: ReplayableCharacterTarget;
  command: StateMutationCommand;
  upToSceneOrder?: number;
  labels?: StateMutationLabelMaps;
  actorResolutions?: ActorResolution[];
}): StateMutationPreview {
  const before = replayCharacterState({
    sheet: params.sheet,
    ruleset: params.ruleset,
    events: params.events,
    target: params.target,
    actorResolutions: params.actorResolutions,
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
  actorResolutions?: ActorResolution[];
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
        actorResolutions: params.actorResolutions,
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
