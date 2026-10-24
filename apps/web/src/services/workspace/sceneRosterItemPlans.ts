import type {
  CharacterSheet,
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
import {hashSceneContent, type PendingInventoryCapture, type RosterPlanResult} from './sceneRosterMutationTypes';
interface CaptureContext {
  activeProject: Project | null;
  selectedDocument: WritingDocument | null;
  pendingInventoryCapture: PendingInventoryCapture | null;
  content: string;
  characterSheets: CharacterSheet[];
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

export function planSelectionInventoryCapture({
  input,
  activeProject,
  selectedDocument,
  pendingInventoryCapture,
  content,
  characterSheets,
  documents,
  categories,
  entities,
  compendiumEntries,
  stateMutationEvents,
  now,
  ids
}: CaptureContext & {
  input: {
    sheetId: string;
    itemName: string;
    quantity: number;
    saveReusable: boolean;
    reusableEntityId?: string;
    canonicalName: string;
  };
}): RosterPlanResult<{
  sheet: CharacterSheet;
  plan: ItemStateAuthoringWritePlan;
}> | null {
  if (!activeProject || !selectedDocument || !pendingInventoryCapture)
    return null;
  if (pendingInventoryCapture.action !== 'acquire') {
    return {error: 'Use the consumption proposal to record this item use.'};
  }
  if (pendingInventoryCapture.sceneId !== selectedDocument.id ||
    pendingInventoryCapture.sourceHash !== hashSceneContent(content)) {
    return {error: 'The source prose changed. Close this proposal and reopen it from the current text.'};
  }
  const sheet = characterSheets.find((candidate) => candidate.id === input.sheetId);
  if (!sheet)
    return null;
  if (!sheet.characterEntityId) {
    return {error: 'Resolve this legacy sheet to a World Bible character before recording state.'};
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
  const normalizedItemName = input.itemName.trim().toLocaleLowerCase();
  const linkedDefinitions = compendiumEntries.filter((entry) => entry.name.trim().toLocaleLowerCase() === normalizedItemName &&
    (!sourceEntityId || entry.sourceEntityId === sourceEntityId));
  const exactDefinition = linkedDefinitions.length === 1
    ? linkedDefinitions[0]
    : resolution.status === 'exact' && resolution.definitionId
      ? compendiumEntries.find((entry) => entry.id === resolution.definitionId) ?? null
      : null;
  const compendiumEntryToSave = input.saveReusable && sourceEntityId && exactDefinition && !exactDefinition.sourceEntityId
    ? {...exactDefinition, sourceEntityId, updatedAt: now}
    : undefined;
  const event: StateMutationEvent = {
    id: ids.event,
    projectId: activeProject.id,
    sceneId: selectedDocument.id,
    sceneTitle: selectedDocument.title,
    sceneOrder,
    sceneSequence: stateMutationEvents
      .filter((entry) => entry.sceneId === selectedDocument.id)
      .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
    scenePosition: pendingInventoryCapture.position,
    sceneAnchor: pendingInventoryCapture.anchor,
    label: `Picks up ${input.itemName}`,
    sourceType: 'manual',
    sourceRevision: selectedDocument.updatedAt,
    sourceHash: hashSceneContent(selectedDocument.content),
    status: 'accepted',
    commands: [
      {
        type: 'inventory_add',
        actorId: sheet.characterEntityId,
        itemName: input.itemName,
        quantity: input.quantity,
        sourceEntityId,
        definitionId: exactDefinition?.id
      }
    ],
    createdAt: now
  };
  const proposalEvent = pendingInventoryCapture.proposalEventId
    ? stateMutationEvents.find((entry) => entry.id === pendingInventoryCapture.proposalEventId)
    : undefined;
  return {
    value: {
      sheet, plan: {
        projectId: activeProject.id, event, entityToSave, compendiumEntryToSave,
        eventToInvalidate: proposalEvent ? {
          ...proposalEvent, status: 'invalidated' as const, invalidatedAt: now,
          invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
        } : undefined
      }
    }
  };
}

export function planSelectionConsumptionCapture({
  input,
  activeProject,
  selectedDocument,
  pendingInventoryCapture,
  content,
  characterSheets,
  documents,
  categories,
  entities,
  compendiumEntries,
  stateMutationEvents,
  now,
  ids
}: CaptureContext & {
  input: {
    sheetId: string;
    itemName: string;
    commands: StateMutationEvent['commands'];
    rememberedConsumable?: CompendiumEntry['consumable'];
    saveReusable: boolean;
    reusableEntityId?: string;
    canonicalName: string;
  };
}): RosterPlanResult<{
  sheet: CharacterSheet;
  plan: ItemStateAuthoringWritePlan;
}> | null {
  if (!activeProject ||
    !selectedDocument ||
    !pendingInventoryCapture ||
    pendingInventoryCapture.action !== 'consume')
    return null;
  if (pendingInventoryCapture.sceneId !== selectedDocument.id ||
    pendingInventoryCapture.sourceHash !== hashSceneContent(content)) {
    return {error: 'The source prose changed. Close this proposal and reopen it from the current text.'};
  }
  const sheet = characterSheets.find((candidate) => candidate.id === input.sheetId);
  if (!sheet?.characterEntityId) {
    return {error: 'Resolve this character sheet to World Bible canon before recording state.'};
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
  const existingDefinition = resolution.status === 'exact' && resolution.definitionId
    ? compendiumEntries.find((entry) => entry.id === resolution.definitionId) ?? null
    : sourceEntityId
      ? compendiumEntries.find((entry) => entry.sourceEntityId === sourceEntityId) ?? null
      : null;
  const definitionId = existingDefinition?.id ?? (input.rememberedConsumable ? ids.definition : undefined);
  const compendiumEntryToSave: CompendiumEntry | undefined = input.rememberedConsumable
    ? {
      id: definitionId as string,
      projectId: activeProject.id,
      name: entityToSave?.name ?? selectedEntity?.name ?? input.itemName,
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
      actorId: sheet.characterEntityId as string,
      sourceEntityId,
      definitionId
    }
    : {...command, actorId: sheet.characterEntityId as string});
  const event: StateMutationEvent = {
    id: ids.event,
    projectId: activeProject.id,
    sceneId: selectedDocument.id,
    sceneTitle: selectedDocument.title,
    sceneOrder,
    sceneSequence: stateMutationEvents
      .filter((entry) => entry.sceneId === selectedDocument.id)
      .reduce((max, entry) => Math.max(max, entry.sceneSequence ?? 0), 0) + 1,
    scenePosition: pendingInventoryCapture.position,
    sceneAnchor: pendingInventoryCapture.anchor,
    label: `Consumes ${input.itemName}`,
    sourceType: 'manual',
    sourceRevision: selectedDocument.updatedAt,
    sourceHash: hashSceneContent(selectedDocument.content),
    status: 'accepted',
    commands,
    consumableEffect: definitionId
      ? {
        definitionId,
        itemName: input.itemName,
        phase: 'consume'
      }
      : undefined,
    createdAt: now
  };
  const proposalEvent = pendingInventoryCapture.proposalEventId
    ? stateMutationEvents.find((entry) => entry.id === pendingInventoryCapture.proposalEventId)
    : undefined;
  return {
    value: {
      sheet, plan: {
        projectId: activeProject.id, event, entityToSave, compendiumEntryToSave,
        eventToInvalidate: proposalEvent ? {
          ...proposalEvent, status: 'invalidated' as const, invalidatedAt: now,
          invalidationReason: 'Replaced by author-confirmed Workspace item proposal.'
        } : undefined
      }
    }
  };
}
