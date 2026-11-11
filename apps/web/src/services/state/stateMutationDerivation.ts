import type {StateMutationEvent, StoredRuleset} from '../../entityTypes';
import type {ObservationProposal} from '../worldEngine';
import type {ActorResolution} from '../characters/characterIdentity';
import {
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from './stateReplay';
import {validateStateMutationEvent} from './stateMutationSchemas';
import {stateDeltaObservationToCommand} from './kinds';
import {
  findStateSubject,
  recordableStateSubjects,
  replayStateSubject,
  stateSubjectAccepts,
  type StateSubject
} from './stateSubjects';

export function buildDerivedStateMutationEvents(params: {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  sceneOrder: number;
  sourceRevision: number;
  sourceHash: string;
  observations: ObservationProposal[];
  stateSubjects: StateSubject[];
  ruleset: StoredRuleset | null;
  existingEvents: StateMutationEvent[];
  actorResolutions?: ActorResolution[];
  createdAt?: number;
}): StateMutationEvent[] {
  const relevantObservations = params.observations.filter(
    (observation): observation is Extract<ObservationProposal, {type: 'state_delta_candidate'}> =>
      observation.type === 'state_delta_candidate'
  );

  const nonGeneratedEvents = params.existingEvents.filter(
    (event) =>
      !(
        event.sceneId === params.sceneId &&
        event.sourceType === 'deterministic-review' &&
        event.status === 'accepted'
      )
  );
  const sceneSequenceStart =
    nonGeneratedEvents
      .filter((event) => event.sceneId === params.sceneId && event.status === 'accepted')
      .reduce((max, event) => Math.max(max, event.sceneSequence ?? 0), 0) + 1;

  const nextEvents: StateMutationEvent[] = [];
  const acceptedPreviewEvents = (): StateMutationEvent[] =>
    nextEvents.map((event) => ({
      ...event,
      status: 'accepted' as const
    }));

  const recordableSubjects = recordableStateSubjects(params.stateSubjects);
  relevantObservations.forEach((observation, index) => {
    const subject = findStateSubject(observation.actor, recordableSubjects);
    if (!subject) {
      return;
    }
    const command = stateDeltaObservationToCommand(observation, subject.actorId);
    if (!command || !stateSubjectAccepts(subject, command)) {
      return;
    }

    const event: StateMutationEvent = {
      id: crypto.randomUUID(),
      projectId: params.projectId,
      sceneId: params.sceneId,
      sceneTitle: params.sceneTitle,
      sceneOrder: params.sceneOrder,
      sceneSequence: sceneSequenceStart + index,
      scenePosition: observation.evidence.end,
      label: observation.evidence.text,
      sourceType: 'deterministic-review',
      sourceRevision: params.sourceRevision,
      sourceHash: params.sourceHash,
      status: 'proposed',
      commands: [command],
      createdAt: params.createdAt ?? Date.now()
    };

    const stateBefore = replayStateSubject({
      subject,
      ruleset: params.ruleset,
      events: [...nonGeneratedEvents, ...acceptedPreviewEvents()],
      actorResolutions: params.actorResolutions,
      upToSceneOrder: params.sceneOrder
    });
    const ruleErrors = validateStateMutationEventForRuleset({
      event,
      ruleset: params.ruleset
    });
    const stateErrors = validateStateMutationCommandAgainstState({
      state: stateBefore,
      command
    });

    const reviewableMissingInventory =
      command.type === 'inventory_consume' && stateErrors.length > 0;
    if (ruleErrors.length > 0 || (stateErrors.length > 0 && !reviewableMissingInventory)) {
      return;
    }

    validateStateMutationEvent(event);
    nextEvents.push(event);
  });

  return nextEvents;
}
