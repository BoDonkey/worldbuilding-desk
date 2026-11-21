import type {
  CompendiumEntry,
  EntityCategory,
  Project,
  StateMutationEvent,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {resolveReusableItem, type ItemStateAuthoringWritePlan} from '../state/itemStateAuthoringService';
import {sortWritingDocuments} from '../storage';
import {isItemCategory} from '../worldBible/worldBibleSummary';
import {findStateSubject, stateSubjectAccepts, type StateSubject} from '../state/stateSubjects';
import type {PendingInventoryCapture, RosterPlanResult} from './sceneRosterMutationTypes';
import {hashString} from '../../utils/hashString';
interface CaptureContext {
  activeProject: Project | null;
  selectedDocument: WritingDocument | null;
  pendingInventoryCapture: PendingInventoryCapture | null;
  content: string;
  stateSubjects: StateSubject[];
  documents: WritingDocument[];
  categories: EntityCategory[];
  entities: WorldEntity[];
  compendiumEntries: CompendiumEntry[];
  stateMutationEvents: StateMutationEvent[];
  now: number;
  ids: {
    entity: string;
    definition: string;
    event: string;
  };
}

interface ItemCaptureInput {
  actorId: string;
  itemName: string;
  saveReusable: boolean;
  reusableEntityId?: string;
  canonicalName: string;
}

/** What both item captures settle before they build their own event (slice 3.66). */
interface ItemCaptureBase {
  activeProject: Project;
  selectedDocument: WritingDocument;
  pendingInventoryCapture: PendingInventoryCapture;
  subject: StateSubject;
  sceneOrder: number;
  sceneSequence: number;
  selectedEntity: WorldEntity | null;
  entityToSave?: WorldEntity;
  sourceEntityId?: string;
  /** The item's compendium entry: the resolver's exact match, else the one linked to the item record. */
  definition: CompendiumEntry | null;
  eventToInvalidate?: StateMutationEvent;
}

/**
 * The shared part of an item pickup or use: the prose is unchanged, the
 * character can hold state, the scene is in the manuscript, and the item
 * resolves to a record and compendium entry. A missing character is an error
 * for both actions, not a silent no-op.
 */
function planItemCaptureBase(
  context: CaptureContext & {
    activeProject: Project;
    selectedDocument: WritingDocument;
    pendingInventoryCapture: PendingInventoryCapture;
  },
  input: ItemCaptureInput,
  commands?: StateMutationEvent['commands']
): RosterPlanResult<ItemCaptureBase> | null {
  const {
    activeProject,
    selectedDocument,
    pendingInventoryCapture,
    content,
    stateSubjects,
    documents,
    categories,
    entities,
    compendiumEntries,
    stateMutationEvents,
    now,
    ids
  } = context;
  if (pendingInventoryCapture.sceneId !== selectedDocument.id ||
    pendingInventoryCapture.sourceHash !== hashString(content)) {
    return {error: 'The source prose changed. Close this proposal and reopen it from the current text.'};
  }
  const subject = findStateSubject(input.actorId, stateSubjects);
  if (!subject) {
    return {error: 'This character is no longer in the project. Choose another character and try again.'};
  }
  if (subject.legacy) {
    return {error: 'Resolve this legacy sheet to a World Bible character before recording state.'};
  }
  if (commands && !commands.every((command) => stateSubjectAccepts(subject, command))) {
    return {error: `${subject.name} has no character sheet, so only item and place changes can be recorded.`};
  }
  const sceneOrder = sortWritingDocuments(documents).findIndex((document) => document.id === selectedDocument.id) + 1;
  if (sceneOrder <= 0)
    return null;
  const resolution = resolveReusableItem({
    itemName: input.itemName,
    categories,
    entities,
    compendiumEntries
  });
  const itemCategory = categories.find(isItemCategory) ?? null;
  const selectedEntity = input.reusableEntityId
    ? entities.find((entity) => entity.id === input.reusableEntityId) ?? null
    : null;
  if (input.saveReusable && !selectedEntity && !itemCategory) {
    return {error: 'Create an Items category before saving a reusable world item.'};
  }
  const entityToSave: WorldEntity | undefined = input.saveReusable && !selectedEntity && itemCategory
    ? {
      id: ids.entity,
      projectId: activeProject.id,
      categoryId: itemCategory.id,
      name: input.canonicalName || input.itemName,
      fields: {description: ''},
      needsCompletion: true,
      links: [],
      createdAt: now,
      updatedAt: now
    }
    : undefined;
  const sourceEntityId = selectedEntity?.id ??
    entityToSave?.id ??
    (resolution.status === 'exact' ? resolution.sourceEntityId : undefined);
  // Decided (author, 2026-11-21): the resolver's exact match first, then the
  // entry linked to the item record. The resolver's entry is skipped when it
  // belongs to a different item than the one chosen.
  const resolvedDefinition = resolution.status === 'exact' && resolution.definitionId
    ? compendiumEntries.find((entry) => entry.id === resolution.definitionId) ?? null
    : null;
  const resolvedFits = Boolean(resolvedDefinition) &&
    (!sourceEntityId || !resolvedDefinition?.sourceEntityId || resolvedDefinition.sourceEntityId === sourceEntityId);
  const definition = resolvedFits
    ? resolvedDefinition
    : sourceEntityId
      ? compendiumEntries.find((entry) => entry.sourceEntityId === sourceEntityId) ?? null
      : null;
  const proposalEvent = pendingInventoryCapture.proposalEventId
    ? stateMutationEvents.find((entry) => entry.id === pendingInventoryCapture.proposalEventId)
    : undefined;
  return {
    value: {
      activeProject,
      selectedDocument,
      pendingInventoryCapture,
      subject,
      sceneOrder,
      sceneSequence: stateMutationEvents
        .filter((entry) => entry.sceneId === selectedDocument.id)
        .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
      selectedEntity,
      entityToSave,
      sourceEntityId,
      definition,
      eventToInvalidate: proposalEvent ? {
        ...proposalEvent, status: 'invalidated' as const, invalidatedAt: now,
        invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
      } : undefined
    }
  };
}

/** The event fields both captures share; each adds its label and commands. */
const baseItemEvent = (base: ItemCaptureBase, eventId: string, now: number) => ({
  id: eventId,
  projectId: base.activeProject.id,
  sceneId: base.selectedDocument.id,
  sceneTitle: base.selectedDocument.title,
  sceneOrder: base.sceneOrder,
  sceneSequence: base.sceneSequence,
  scenePosition: base.pendingInventoryCapture.position,
  sceneAnchor: base.pendingInventoryCapture.anchor,
  sourceType: 'manual' as const,
  sourceRevision: base.selectedDocument.updatedAt,
  sourceHash: hashString(base.selectedDocument.content),
  status: 'accepted' as const,
  createdAt: now
});

export function planSelectionInventoryCapture({
  input,
  ...context
}: CaptureContext & {
  input: ItemCaptureInput & {quantity: number};
}): RosterPlanResult<{
  subject: StateSubject;
  plan: ItemStateAuthoringWritePlan;
}> | null {
  const {activeProject, selectedDocument, pendingInventoryCapture, now, ids} = context;
  if (!activeProject || !selectedDocument || !pendingInventoryCapture)
    return null;
  if (pendingInventoryCapture.action !== 'acquire') {
    return {error: 'Use the consumption proposal to record this item use.'};
  }
  const result = planItemCaptureBase({...context, activeProject, selectedDocument, pendingInventoryCapture}, input);
  if (!result || result.error !== undefined) return result;
  const base = result.value;
  const {definition, sourceEntityId} = base;
  const compendiumEntryToSave = input.saveReusable && sourceEntityId && definition && !definition.sourceEntityId
    ? {...definition, sourceEntityId, updatedAt: now}
    : undefined;
  const event: StateMutationEvent = {
    ...baseItemEvent(base, ids.event, now),
    label: `Picks up ${input.itemName}`,
    commands: [
      {
        type: 'inventory_add',
        actorId: base.subject.actorId,
        itemName: input.itemName,
        quantity: input.quantity,
        sourceEntityId,
        definitionId: definition?.id
      }
    ]
  };
  return {
    value: {
      subject: base.subject,
      plan: {
        projectId: activeProject.id,
        event,
        entityToSave: base.entityToSave,
        compendiumEntryToSave,
        eventToInvalidate: base.eventToInvalidate
      }
    }
  };
}

export function planSelectionConsumptionCapture({
  input,
  ...context
}: CaptureContext & {
  input: ItemCaptureInput & {
    commands: StateMutationEvent['commands'];
    rememberedConsumable?: CompendiumEntry['consumable'];
  };
}): RosterPlanResult<{
  subject: StateSubject;
  plan: ItemStateAuthoringWritePlan;
}> | null {
  const {activeProject, selectedDocument, pendingInventoryCapture, now, ids} = context;
  if (!activeProject ||
    !selectedDocument ||
    !pendingInventoryCapture ||
    pendingInventoryCapture.action !== 'consume')
    return null;
  const result = planItemCaptureBase(
    {...context, activeProject, selectedDocument, pendingInventoryCapture},
    input,
    input.commands
  );
  if (!result || result.error !== undefined) return result;
  const base = result.value;
  const {definition: existingDefinition, sourceEntityId, subject} = base;
  const definitionId = existingDefinition?.id ?? (input.rememberedConsumable ? ids.definition : undefined);
  const compendiumEntryToSave: CompendiumEntry | undefined = input.rememberedConsumable
    ? {
      id: definitionId as string,
      projectId: activeProject.id,
      name: base.entityToSave?.name ?? base.selectedEntity?.name ?? input.itemName,
      domain: existingDefinition?.domain ?? 'artifact',
      sourceEntityId,
      description: existingDefinition?.description,
      tags: existingDefinition?.tags ?? [],
      mechanicKind: existingDefinition?.mechanicKind ?? 'general',
      progressScope: existingDefinition?.progressScope ?? 'character',
      needsCompletion: false,
      consumable: input.rememberedConsumable,
      actions: existingDefinition?.actions ?? [],
      createdAt: existingDefinition?.createdAt ?? now,
      updatedAt: now
    }
    : existingDefinition && sourceEntityId && !existingDefinition.sourceEntityId
      ? {...existingDefinition, sourceEntityId, updatedAt: now}
      : undefined;
  const commands = input.commands.map((command) => command.type.startsWith('inventory_')
    ? {
      ...command,
      actorId: subject.actorId,
      sourceEntityId,
      definitionId
    }
    : {...command, actorId: subject.actorId});
  const event: StateMutationEvent = {
    ...baseItemEvent(base, ids.event, now),
    label: `Consumes ${input.itemName}`,
    commands,
    consumableEffect: definitionId
      ? {
        definitionId,
        itemName: input.itemName,
        phase: 'consume'
      }
      : undefined
  };
  return {
    value: {
      subject,
      plan: {
        projectId: activeProject.id,
        event,
        entityToSave: base.entityToSave,
        compendiumEntryToSave,
        eventToInvalidate: base.eventToInvalidate
      }
    }
  };
}
