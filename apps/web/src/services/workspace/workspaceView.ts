import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  EntityCategory,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import type {
  SceneRosterAddOption,
  SceneRosterCharacterCard,
  SceneRosterItemCard
} from '../../components/Workspace/SceneRosterPanel';
import type {ConsistencyAlias} from '../consistency';
import {
  type CharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue
} from '../compendium';
import {findConsumableEntry} from '../state/consumableEffects';
import {
  applyStateMutationCommand,
  compareStateMutationEvents,
  replayCharacterState
} from '../state/stateReplay';
import {
  describeStateMutationEventStaleness,
  getStateMutationEventStaleness
} from '../state/stateMutationStaleness';
import {
  summarizeStateMutationCommand,
  summarizeStateMutationEffects
} from '../state/stateMutationPresentation';
import {sortWritingDocuments} from '../../writingStorage';
import {
  selectSceneRoster,
  type SceneRosterCandidate,
  type SceneRosterOverrides
} from './sceneRoster';
import {
  createCharacterLinkResolver,
  isCharacterCategory,
  type ActorResolution
} from '../characters/characterIdentity';

const displayRosterFieldValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const text = value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || null;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const values = value
      .map((entry) => displayRosterFieldValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return values.length > 0 ? values.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
};

export interface SceneRosterModel {
  sceneTitle: string | null;
  characters: SceneRosterCharacterCard[];
  items: SceneRosterItemCard[];
  addOptions: SceneRosterAddOption[];
  ambiguousSurfaces: string[];
}

export function buildSceneRosterModel(params: {
  selectedDocument: WritingDocument | null;
  categories: EntityCategory[];
  characters: Character[];
  entities: WorldEntity[];
  characterSheets: CharacterSheet[];
  actorResolutions?: ActorResolution[];
  aliases: ConsistencyAlias[];
  content: string;
  overrides: SceneRosterOverrides;
  documents: WritingDocument[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  stateMoment: 'opening' | 'cursor' | 'ending';
  cursorPosition: number;
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  compendiumEntries: CompendiumEntry[];
}): SceneRosterModel {
  const sceneTitle =
    params.selectedDocument?.title || (params.selectedDocument ? 'Untitled scene' : null);
  if (!params.selectedDocument) {
    return {
      sceneTitle,
      characters: [],
      items: [],
      addOptions: [],
      ambiguousSurfaces: []
    };
  }

  const characterCategoryIds = new Set(
    params.categories
      .filter(isCharacterCategory)
      .map((category) => category.id)
  );
  const characterById = new Map(
    params.characters.map((character) => [character.id, character])
  );
  const entityById = new Map(params.entities.map((entity) => [entity.id, entity]));
  const categoryById = new Map(
    params.categories.map((category) => [category.id, category])
  );
  const characterResolver = createCharacterLinkResolver({
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.characterSheets,
    actorResolutions: params.actorResolutions
  });
  const sheetByCharacterId = new Map(
    params.characterSheets
      .filter((sheet) => Boolean(sheet.characterId))
      .map((sheet) => [sheet.characterId as string, sheet])
  );
  const candidates: SceneRosterCandidate[] = [];
  const characterSheetByKey = new Map<string, CharacterSheet | null>();
  const characterRecordByKey = new Map<string, Character | null>();

  params.characterSheets.forEach((sheet) => {
    const characterEntityId = characterResolver.resolveEntityId({
      sheetId: sheet.id,
      characterId: sheet.characterId
    });
    const character =
      (sheet.characterId ? characterById.get(sheet.characterId) : null) ??
      (characterEntityId ? characterResolver.getCharacter(characterEntityId) : null) ??
      null;
    const characterEntity = characterEntityId
      ? characterResolver.getEntity(characterEntityId)
      : undefined;
    const aliasValues = params.aliases
      .filter(
        (alias) =>
          (alias.targetType === 'character' && alias.targetId === character?.id) ||
          (alias.targetType === 'entity' && alias.targetId === characterEntity?.id)
      )
      .map((alias) => alias.alias);
    const key = `character:${sheet.id}`;
    candidates.push({
      key,
      type: 'character',
      id: sheet.id,
      name: characterEntity?.name ?? sheet.name,
      aliases: aliasValues
    });
    characterSheetByKey.set(key, sheet);
    characterRecordByKey.set(key, character);
  });

  params.characters.forEach((character) => {
    const characterEntityId = characterResolver.resolveEntityId({
      characterId: character.id
    });
    if (
      sheetByCharacterId.has(character.id) ||
      (characterEntityId && characterResolver.getSheet(characterEntityId))
    ) {
      return;
    }
    const characterEntity = characterEntityId
      ? characterResolver.getEntity(characterEntityId)
      : undefined;
    const key = `character-record:${character.id}`;
    candidates.push({
      key,
      type: 'character',
      id: character.id,
      name: character.name,
      aliases: params.aliases
        .filter(
          (alias) =>
            (alias.targetType === 'character' && alias.targetId === character.id) ||
            (alias.targetType === 'entity' && alias.targetId === characterEntity?.id)
        )
        .map((alias) => alias.alias)
    });
    characterSheetByKey.set(key, null);
    characterRecordByKey.set(key, character);
  });

  params.entities
    .filter((entity) => !characterCategoryIds.has(entity.categoryId))
    .forEach((entity) => {
      candidates.push({
        key: `entity:${entity.id}`,
        type: 'entity',
        id: entity.id,
        name: entity.name,
        aliases: params.aliases
          .filter(
            (alias) => alias.targetType === 'entity' && alias.targetId === entity.id
          )
          .map((alias) => alias.alias)
      });
    });

  const selection = selectSceneRoster({
    content: params.content,
    candidates,
    overrides: params.overrides
  });
  const orderedDocuments = sortWritingDocuments(params.documents);
  const selectedSceneOrder =
    orderedDocuments.findIndex(
      (document) => document.id === params.selectedDocument?.id
    ) + 1;

  const characterCards = selection.entries
    .filter((entry) => entry.type === 'character')
    .map((entry): SceneRosterCharacterCard => {
      const sheet = characterSheetByKey.get(entry.key) ?? null;
      const character = characterRecordByKey.get(entry.key) ?? null;
      if (!sheet) {
        return {
          key: entry.key,
          id: character?.id ?? entry.id,
          name: entry.name,
          role:
            (typeof character?.fields.role === 'string' && character.fields.role.trim()) ||
            'Role not set',
          source: entry.source,
          matchedSurface: entry.matchedSurface,
          stats: [],
          resources: [],
          inventory: [],
          statuses: [],
          hasSheet: false
        };
      }
      const replayed = replayCharacterState({
        sheet,
        ruleset: params.ruleset,
        events: params.stateMutationEvents,
        target: {
          actorId: sheet.characterEntityId,
          characterId: sheet.characterId,
          sheetId: sheet.id,
          actorName: sheet.name
        },
        actorResolutions: params.actorResolutions,
        upToSceneOrder:
          params.stateMoment === 'opening'
            ? Math.max(0, selectedSceneOrder - 1)
            : selectedSceneOrder,
        upToScenePosition:
          params.stateMoment === 'cursor' ? params.cursorPosition : undefined
      });
      return {
        key: entry.key,
        id: character?.id ?? sheet.id,
        sheetId: sheet.id,
        name: entry.name,
        role:
          (typeof character?.fields.role === 'string' && character.fields.role.trim()) ||
          'Role not set',
        level: Math.max(1, sheet.level + params.runtimeModifiers.levelBonus),
        source: entry.source,
        matchedSurface: entry.matchedSurface,
        stats: Object.entries(replayed.stats).map(([id, value]) => ({
          id,
          label: params.statDefinitionNameById.get(id) ?? id,
          value:
            typeof value === 'number'
              ? String(
                  getEffectiveStatValue({
                    definitionId: id,
                    baseValue: value,
                    runtime: params.runtimeModifiers
                  })
                )
              : String(value)
        })),
        resources: Object.entries(replayed.resources.current).map(([id, current]) => {
          const effective = getEffectiveResourceValues({
            definitionId: id,
            current,
            max: replayed.resources.max[id] ?? current,
            runtime: params.runtimeModifiers
          });
          return {
            id,
            label: params.resourceDefinitionNameById.get(id) ?? id,
            current: effective.current,
            max: effective.max
          };
        }),
        inventory: replayed.inventory.items.map((item) => {
          const linkedEntry = item.definitionId
            ? params.compendiumEntries.find((entry) => entry.id === item.definitionId) ?? null
            : null;
          const linkedEntityId = item.sourceEntityId ?? linkedEntry?.sourceEntityId;
          const linkedEntity = linkedEntityId ? entityById.get(linkedEntityId) ?? null : null;
          const resolvedItem = {
            ...item,
            name: linkedEntity?.name ?? linkedEntry?.name ?? item.name
          };
          const consumableEntry = findConsumableEntry({
            entries: params.compendiumEntries,
            item: resolvedItem
          });
          return {
            ...resolvedItem,
            equipped: replayed.inventory.equipped.some(
              (name) =>
                name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase()
            ),
            consumable: consumableEntry?.consumable
              ? {
                  definitionId: consumableEntry.id,
                  durationLabel: consumableEntry.consumable.durationLabel
                }
              : undefined
          };
        }),
        statuses: Array.from(
          new Set([...replayed.statuses, ...params.runtimeModifiers.notes])
        ),
        location: replayed.locationName,
        hasSheet: true
      };
    });

  const itemCards = selection.entries
    .filter((entry) => entry.type === 'entity')
    .map((entry): SceneRosterItemCard | null => {
      const entity = entityById.get(entry.id);
      if (!entity) return null;
      const category = categoryById.get(entity.categoryId);
      const schemaKeys = new Set(category?.fieldSchema.map((field) => field.key) ?? []);
      const schemaFields =
        category?.fieldSchema.flatMap((field) => {
          const value = displayRosterFieldValue(entity.fields[field.key]);
          return value ? [{id: field.key, label: field.label, value}] : [];
        }) ?? [];
      const extraFields = Object.entries(entity.fields).flatMap(([key, rawValue]) => {
        if (schemaKeys.has(key)) return [];
        const value = displayRosterFieldValue(rawValue);
        return value ? [{id: key, label: key.replace(/_/g, ' '), value}] : [];
      });
      return {
        key: entry.key,
        id: entity.id,
        name: entity.name,
        categoryLabel: category?.name ?? 'World entity',
        icon: category?.icon,
        source: entry.source,
        matchedSurface: entry.matchedSurface,
        fields: [...schemaFields, ...extraFields]
      };
    })
    .filter((entry): entry is SceneRosterItemCard => Boolean(entry));

  const selectedKeys = new Set(selection.entries.map((entry) => entry.key));
  const addOptions = candidates
    .filter((candidate) => !selectedKeys.has(candidate.key))
    .map((candidate): SceneRosterAddOption => ({
      key: candidate.key,
      name: candidate.name,
      group: candidate.type === 'character' ? 'Characters' : 'Items & entities'
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    sceneTitle,
    characters: characterCards,
    items: itemCards,
    addOptions,
    ambiguousSurfaces: selection.ambiguousSurfaces
  };
}

export interface SceneTimelineModel {
  sceneTitle: string;
  entries: Array<{
    id: string;
    status: 'accepted' | 'invalidated';
    stepLabel: string;
    actorLabel: string;
    summaryLines: string[];
    effectLines: string[];
    isStale: boolean;
    staleLabel: string;
  }>;
  snapshots: Array<{actorLabel: string; lines: string[]}>;
}

export function buildSelectedSceneTimeline(params: {
  selectedDocument: WritingDocument | null;
  stateMutationEvents: StateMutationEvent[];
  characterSheets: CharacterSheet[];
  actorResolutions?: ActorResolution[];
  ruleset: StoredRuleset | null;
  documents: WritingDocument[];
  resourceDefinitionNameById: Map<string, string>;
  statDefinitionNameById: Map<string, string>;
}): SceneTimelineModel | null {
  if (!params.selectedDocument) {
    return null;
  }

  const selectedSceneEvents = params.stateMutationEvents
    .filter(
      (
        event
      ): event is StateMutationEvent & {
        status: 'accepted' | 'invalidated';
      } =>
        event.sceneId === params.selectedDocument?.id && event.status !== 'proposed'
    )
    .slice()
    .sort(compareStateMutationEvents);
  const acceptedEvents = params.stateMutationEvents
    .filter((event) => event.status === 'accepted')
    .slice()
    .sort(compareStateMutationEvents);
  const sheetByActorId = new Map<string, CharacterSheet>();
  params.characterSheets.forEach((sheet) => {
    sheetByActorId.set(sheet.id, sheet);
    if (sheet.characterId) {
      sheetByActorId.set(sheet.characterId, sheet);
    }
    if (sheet.characterEntityId) {
      sheetByActorId.set(sheet.characterEntityId, sheet);
    }
  });
  params.actorResolutions?.forEach((resolution) => {
    const sheet = sheetByActorId.get(resolution.entityId);
    if (sheet) sheetByActorId.set(resolution.legacyActorId, sheet);
  });

  const actorStateById = new Map<
    string,
    ReturnType<typeof replayCharacterState>
  >();
  const actorIdsTouchedInSelectedScene = new Set<string>();
  const entries: SceneTimelineModel['entries'] = [];

  for (const event of acceptedEvents) {
    for (const command of event.commands) {
      const sheet = sheetByActorId.get(command.actorId);
      if (!sheet) {
        continue;
      }
      const actorStateKey = sheet.id;
      const before =
        actorStateById.get(actorStateKey) ??
        replayCharacterState({
          sheet,
          ruleset: params.ruleset,
          events: [],
          target: {
            actorId: command.actorId,
            characterId: sheet.characterId,
            sheetId: sheet.id,
            actorName: sheet.name
          },
          actorResolutions: params.actorResolutions
        });
      const after = applyStateMutationCommand(before, command);
      actorStateById.set(actorStateKey, after);

      if (event.sceneId === params.selectedDocument.id) {
        actorIdsTouchedInSelectedScene.add(actorStateKey);
        const existingEntry = entries.find((entry) => entry.id === event.id);
        const summaryLine = summarizeStateMutationCommand({
          command,
          labels: {
            resourceDefinitionNameById: params.resourceDefinitionNameById,
            statDefinitionNameById: params.statDefinitionNameById
          }
        });
        const effectLines = summarizeStateMutationEffects({
          before,
          after,
          command,
          labels: {
            resourceDefinitionNameById: params.resourceDefinitionNameById,
            statDefinitionNameById: params.statDefinitionNameById
          }
        });
        if (existingEntry) {
          if (existingEntry.actorLabel !== sheet.name) {
            existingEntry.actorLabel = 'Multiple actors';
          }
          existingEntry.summaryLines.push(summaryLine);
          existingEntry.effectLines.push(...effectLines);
        } else {
          const staleness = getStateMutationEventStaleness({
            event,
            documents: params.documents
          });
          entries.push({
            id: event.id,
            status: 'accepted',
            stepLabel: `Step ${event.sceneSequence ?? '?'}`,
            actorLabel: sheet.name,
            summaryLines: [summaryLine],
            effectLines,
            isStale: staleness.isStale,
            staleLabel: describeStateMutationEventStaleness(staleness) ?? ''
          });
        }
      }
    }
  }

  selectedSceneEvents
    .filter((event) => event.status === 'invalidated')
    .forEach((event) => {
      const actorLabel =
        event.commands
          .map((command) => sheetByActorId.get(command.actorId)?.name)
          .find(Boolean) ?? 'Unknown actor';
      const staleness = getStateMutationEventStaleness({
        event,
        documents: params.documents
      });
      entries.push({
        id: event.id,
        status: event.status,
        stepLabel: `Step ${event.sceneSequence ?? '?'}`,
        actorLabel,
        summaryLines: event.commands.map((command) =>
          summarizeStateMutationCommand({
            command,
            labels: {
              resourceDefinitionNameById: params.resourceDefinitionNameById,
              statDefinitionNameById: params.statDefinitionNameById
            }
          })
        ),
        effectLines: [],
        isStale: staleness.isStale,
        staleLabel: describeStateMutationEventStaleness(staleness) ?? ''
      });
    });

  entries.sort((a, b) => {
    const aEvent = selectedSceneEvents.find((event) => event.id === a.id);
    const bEvent = selectedSceneEvents.find((event) => event.id === b.id);
    if (!aEvent || !bEvent) {
      return 0;
    }
    return compareStateMutationEvents(aEvent, bEvent);
  });

  const selectedSceneOrder =
    sortWritingDocuments(params.documents).findIndex(
      (doc) => doc.id === params.selectedDocument?.id
    ) + 1;

  const snapshots = Array.from(actorIdsTouchedInSelectedScene)
    .map((actorStateKey) => {
      const sheet = sheetByActorId.get(actorStateKey);
      if (!sheet) {
        return null;
      }
      const finalState = replayCharacterState({
        sheet,
        ruleset: params.ruleset,
        events: acceptedEvents,
        target: {
          actorId: sheet.characterEntityId,
          characterId: sheet.characterId,
          sheetId: sheet.id,
          actorName: sheet.name
        },
        actorResolutions: params.actorResolutions,
        upToSceneOrder: selectedSceneOrder
      });
      const resourceLines = Object.entries(finalState.resources.current)
        .slice(0, 3)
        .map(([resourceId, value]) => {
          const label =
            params.resourceDefinitionNameById.get(resourceId) ?? resourceId;
          const max = finalState.resources.max[resourceId];
          return `${label} ${value}${typeof max === 'number' ? `/${max}` : ''}`;
        });
      const lines = [
        ...resourceLines,
        finalState.locationName ? `Location ${finalState.locationName}` : '',
        finalState.statuses.length > 0
          ? `Statuses ${finalState.statuses.join(', ')}`
          : ''
      ].filter(Boolean);
      return {
        actorLabel: sheet.name,
        lines: lines.length > 0 ? lines : ['No tracked changes visible.']
      };
    })
    .filter(Boolean) as Array<{actorLabel: string; lines: string[]}>;

  return {
    sceneTitle: params.selectedDocument.title || 'Untitled scene',
    entries,
    snapshots
  };
}

export const normalizeCaptureSelection = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isCharacterLikeCategory = (
  category: Pick<EntityCategory, 'kind'> | null
): boolean => {
  return Boolean(category && isCharacterCategory(category));
};

export interface ManualCaptureLinkOption {
  id: string;
  name: string;
  type: string;
  score: number;
}

export function buildManualCaptureLinkOptions(params: {
  draftText: string | null;
  categories: EntityCategory[];
  characters: Character[];
  entities: WorldEntity[];
}): ManualCaptureLinkOption[] {
  if (params.draftText === null) return [];

  const normalizedSelection = normalizeCaptureSelection(params.draftText);
  const categoryLabelById = new Map(
    params.categories.map((category) => [category.id, category.name])
  );
  const resolver = createCharacterLinkResolver({
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: []
  });
  const candidates = [
    ...params.entities.map((entity) => ({
      id: `entity:${entity.id}`,
      name: entity.name,
      type: categoryLabelById.get(entity.categoryId) ?? 'World Bible'
    })),
    ...params.characters
      .filter((character) => {
        return !resolver.resolveEntityId({characterId: character.id});
      })
      .map((character) => ({
        id: `character:${character.id}`,
        name: character.name,
        type: 'Legacy character data'
      }))
  ];

  return candidates
    .map((candidate) => {
      const normalizedName = normalizeCaptureSelection(candidate.name);
      const exactScore = normalizedName === normalizedSelection ? 0 : 1;
      const overlapScore =
        normalizedName.includes(normalizedSelection) ||
        normalizedSelection.includes(normalizedName)
          ? 0
          : 1;
      return {
        ...candidate,
        score: exactScore + overlapScore
      };
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, 30);
}
