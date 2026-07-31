import type {
  CharacterSheet,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {
  buildStateMutationPreview,
  computeBatchAcceptableStateMutationEventIds,
  describeStateMutationAcceptance,
  summarizeStateMutationCommand
} from '../state/stateMutationPresentation';
import {
  describeStateMutationEventStaleness,
  getStateMutationEventStaleness
} from '../state/stateMutationStaleness';

export interface StateMutationReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  sceneSequence?: number;
  actorLabel: string;
  summaryLines: string[];
  effectLines: string[];
  validationIssues: string[];
  canAccept: boolean;
  canAcceptInBatch: boolean;
  acceptanceHint: string | null;
  isStale: boolean;
  staleLabel: string | null;
}

export interface StateMutationReviewGroupHiddenCounts {
  [sceneId: string]: number;
}

function normalizeForStorage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForStorage);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizeForStorage(nestedValue)])
    );
  }
  return value;
}

export function getHiddenStateMutationReviewKey(event: {
  sceneId: string;
  sourceHash: string;
  commands: StateMutationEvent['commands'];
}): string {
  return JSON.stringify({
    sceneId: event.sceneId,
    sourceHash: event.sourceHash,
    commands: event.commands.map((command) => normalizeForStorage(command))
  });
}

export function buildStateMutationReviewItems(params: {
  characterSheets: CharacterSheet[];
  documents: WritingDocument[];
  hiddenReviewKeys: string[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
}): StateMutationReviewItem[] {
  const actorLabelById = new Map<string, string>();
  const sheetByActorId = new Map<string, CharacterSheet>();
  params.characterSheets.forEach((sheet) => {
    actorLabelById.set(sheet.id, sheet.name);
    sheetByActorId.set(sheet.id, sheet);
    if (sheet.characterId) {
      actorLabelById.set(sheet.characterId, sheet.name);
      sheetByActorId.set(sheet.characterId, sheet);
    }
  });
  const resourceDefinitionNameById = new Map(
    (params.ruleset?.resourceDefinitions ?? []).map((definition) => [
      definition.id,
      definition.name
    ])
  );
  const statDefinitionNameById = new Map(
    (params.ruleset?.statDefinitions ?? []).map((definition) => [
      definition.id,
      definition.name
    ])
  );
  const acceptedEvents = params.stateMutationEvents.filter(
    (event) => event.status === 'accepted'
  );
  const proposedEvents = params.stateMutationEvents.filter(
    (event) =>
      event.status === 'proposed' &&
      event.sourceType === 'deterministic-review'
  );
  const batchAcceptableIds = computeBatchAcceptableStateMutationEventIds({
    proposedEvents,
    acceptedEvents,
    characterSheets: params.characterSheets,
    ruleset: params.ruleset,
    labels: {resourceDefinitionNameById, statDefinitionNameById}
  });

  return proposedEvents
    .filter(
      (event) =>
        !params.hiddenReviewKeys.includes(getHiddenStateMutationReviewKey(event))
    )
    .map((event) => {
      const staleness = getStateMutationEventStaleness({
        event,
        documents: params.documents
      });
      const primaryCommand = event.commands[0];
      const sheet = primaryCommand
        ? sheetByActorId.get(primaryCommand.actorId) ?? null
        : null;
      const preview =
        sheet && primaryCommand
          ? buildStateMutationPreview({
              sheet,
              ruleset: params.ruleset,
              events: acceptedEvents,
              target: {
                actorId: primaryCommand.actorId,
                characterId: sheet.characterId,
                sheetId: sheet.id,
                actorName: sheet.name
              },
              command: primaryCommand,
              upToSceneOrder: event.sceneOrder ?? Number.MAX_SAFE_INTEGER,
              labels: {resourceDefinitionNameById, statDefinitionNameById}
            })
          : null;
      const canAccept = (preview?.validationIssues.length ?? 0) === 0;
      const canAcceptInBatch = batchAcceptableIds.has(event.id);
      return {
        id: event.id,
        sceneId: event.sceneId,
        sceneTitle: event.sceneTitle || 'Untitled scene',
        sceneSequence: event.sceneSequence,
        actorLabel:
          actorLabelById.get(event.commands[0]?.actorId ?? '') ?? 'Unknown actor',
        summaryLines: event.commands.map((command) =>
          summarizeStateMutationCommand({
            command,
            labels: {resourceDefinitionNameById, statDefinitionNameById}
          })
        ),
        effectLines: preview?.effectLines ?? [],
        validationIssues: preview?.validationIssues ?? [],
        canAccept,
        canAcceptInBatch,
        acceptanceHint: describeStateMutationAcceptance({
          canAccept,
          canAcceptInBatch,
          validationIssues: preview?.validationIssues ?? []
        }),
        isStale: staleness.isStale,
        staleLabel: describeStateMutationEventStaleness(staleness)
      };
    })
    .sort((a, b) => {
      if (a.sceneTitle !== b.sceneTitle) {
        return a.sceneTitle.localeCompare(b.sceneTitle);
      }
      return (
        (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
        (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

export function countHiddenStateMutationReviewsByScene(params: {
  stateMutationEvents: StateMutationEvent[];
  hiddenReviewKeys: string[];
}): StateMutationReviewGroupHiddenCounts {
  const counts: StateMutationReviewGroupHiddenCounts = {};
  params.stateMutationEvents
    .filter(
      (event) =>
        event.status === 'proposed' &&
        event.sourceType === 'deterministic-review'
    )
    .forEach((event) => {
      if (!params.hiddenReviewKeys.includes(getHiddenStateMutationReviewKey(event))) {
        return;
      }
      counts[event.sceneId] = (counts[event.sceneId] ?? 0) + 1;
    });
  return counts;
}
