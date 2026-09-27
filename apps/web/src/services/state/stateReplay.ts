import type {StateMutationEvent} from '../../entityTypes';
import {getAcceptedStateMutationEvents} from '@worldbuilding-desk/rules-engine';
import {getStateMutationEventsByProject} from './stateMutationLedger';

// Ordering, command application, replay, and ruleset validation live in the
// rules engine (Slice 3.10). Persistence stays here.
export {
  compareStateMutationEvents,
  getAcceptedStateMutationEvents,
  applyStateMutationCommand,
  validateStateMutationCommandAgainstState,
  replayCharacterState,
  validateStateMutationEventForRuleset
} from '@worldbuilding-desk/rules-engine';
export type {
  CharacterReplayState,
  ReplayableCharacterTarget
} from '@worldbuilding-desk/rules-engine';

export async function getAcceptedStateMutationEventsByProject(
  projectId: string
): Promise<StateMutationEvent[]> {
  const events = await getStateMutationEventsByProject(projectId);
  return getAcceptedStateMutationEvents(events);
}
