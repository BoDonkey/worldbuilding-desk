import {useMemo} from 'react';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  StatBlockStyle,
  SystemHistoryEntry,
  WorldEntity
} from '../entityTypes';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import type {ConsistencyAlias} from '../services/consistency';
import type {Project} from '../entityTypes';
import {getCachedSynopsis, setCachedSynopsis} from '../services/editor';

type SnippetEntry = {name: string; html: string; lore: LoreInspectorRecord};

export type LoreSnippets = {
  characters: Record<string, SnippetEntry>;
  entities: Record<string, SnippetEntry>;
};

interface UseWorkspaceLoreSnippetsParams {
  activeProject: Project | null;
  categories: EntityCategory[];
  characters: Character[];
  characterSheets: CharacterSheet[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  systemHistoryEntries: SystemHistoryEntry[];
  resolveCharacterBlock: (sheet: CharacterSheet, style: StatBlockStyle) => string;
  resolveItemBlock: (entity: WorldEntity, style: StatBlockStyle) => string;
}

export function useWorkspaceLoreSnippets({
  activeProject,
  categories,
  characters,
  characterSheets,
  entities,
  aliases,
  systemHistoryEntries,
  resolveCharacterBlock,
  resolveItemBlock
}: UseWorkspaceLoreSnippetsParams): LoreSnippets {
  return useMemo(() => {
    if (!activeProject) {
      return {characters: {}, entities: {}};
    }

    const normalize = (input: string) =>
      input
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const characterById = new Map(characters.map((character) => [character.id, character]));
    const characterSheetByCharacterId = new Map(
      characterSheets
        .filter((sheet): sheet is CharacterSheet & {characterId: string} => Boolean(sheet.characterId))
        .map((sheet) => [sheet.characterId, sheet])
    );
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const recentSystemMessageFor = (name: string): string => {
      const normalized = name.trim().toLowerCase();
      const match = systemHistoryEntries.find((entry) =>
        entry.message.toLowerCase().includes(normalized)
      );
      return match?.message ?? 'No recent linked system event.';
    };

    const buildCharacterLore = (sheet: CharacterSheet): LoreInspectorRecord => {
      const character = sheet.characterId ? characterById.get(sheet.characterId) : null;
      const role =
        typeof character?.fields.role === 'string' && character.fields.role.trim()
          ? character.fields.role.trim()
          : 'Unassigned class';
      const statuses = (sheet.statuses ?? []).slice(0, 2);
      const faction =
        typeof character?.fields.faction === 'string' && character.fields.faction.trim()
          ? character.fields.faction.trim()
          : 'Unknown faction';
      const cached = getCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof character?.fields.goal === 'string' && character.fields.goal.trim()) ||
            'No explicit active goal recorded.',
          recentEvent: recentSystemMessageFor(sheet.name),
          motivation:
            (typeof character?.fields.motivation === 'string' &&
              character.fields.motivation.trim()) ||
            character?.description?.trim() ||
            'No explicit motivation captured yet.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, sheet.id, sheet.updatedAt, synopsis);
      }
      return {
        type: 'character',
        id: sheet.id,
        name: sheet.name,
        vitalSigns: [
          `Level ${sheet.level}`,
          role,
          statuses.length > 0 ? statuses.join(', ') : 'No active buffs/debuffs',
          `Faction: ${faction}`
        ],
        synopsis
      };
    };

    const buildEntityLore = (entity: WorldEntity): LoreInspectorRecord => {
      const categoryName = categoryNameById.get(entity.categoryId) ?? 'Entity';
      const status =
        typeof entity.fields.status === 'string' && entity.fields.status.trim()
          ? entity.fields.status.trim()
          : 'State unknown';
      const cached = getCachedSynopsis(activeProject.id, entity.id, entity.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof entity.fields.goal === 'string' && entity.fields.goal.trim()) ||
            `Track relevance of ${entity.name} in this scene.`,
          recentEvent: recentSystemMessageFor(entity.name),
          motivation:
            (typeof entity.fields.motivation === 'string' &&
              entity.fields.motivation.trim()) ||
            (typeof entity.fields.notes === 'string' && entity.fields.notes.trim()) ||
            'No motivation/secret recorded.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, entity.id, entity.updatedAt, synopsis);
      }
      return {
        type: 'entity',
        id: entity.id,
        name: entity.name,
        vitalSigns: [categoryName, status],
        synopsis
      };
    };

    const characterEntries: Array<[string, SnippetEntry]> = [];
    const entityEntries: Array<[string, SnippetEntry]> = [];
    const surnameCandidates = new Map<
      string,
      Array<{bucket: 'characters' | 'entities'; entry: SnippetEntry}>
    >();

    const registerEntry = (
      bucket: 'characters' | 'entities',
      label: string,
      entry: SnippetEntry
    ) => {
      const key = normalize(label);
      if (!key) return;
      const indexedEntry = {
        ...entry,
        name: label
      };
      if (bucket === 'characters') {
        characterEntries.push([key, indexedEntry]);
      } else {
        entityEntries.push([key, indexedEntry]);
      }

      const tokens = label.trim().split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return;
      const trailing = normalize(tokens[tokens.length - 1] ?? '');
      if (!trailing || trailing.length < 4) return;
      const existing = surnameCandidates.get(trailing) ?? [];
      existing.push({bucket, entry: indexedEntry});
      surnameCandidates.set(trailing, existing);
    };

    characterSheets.forEach((sheet) => {
      const entry = {
        name: sheet.name,
        html: resolveCharacterBlock(sheet, 'compact'),
        lore: buildCharacterLore(sheet)
      };
      registerEntry('characters', sheet.name, entry);
    });

    entities.forEach((entity) => {
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', entity.name, entry);
    });

    aliases.forEach((alias) => {
      if (alias.targetType === 'character') {
        const sheet = characterSheetByCharacterId.get(alias.targetId);
        if (!sheet) return;
        const entry = {
          name: sheet.name,
          html: resolveCharacterBlock(sheet, 'compact'),
          lore: buildCharacterLore(sheet)
        };
        registerEntry('characters', alias.alias, entry);
        return;
      }
      const entity = entityById.get(alias.targetId);
      if (!entity) return;
      const entry = {
        name: entity.name,
        html: resolveItemBlock(entity, 'compact'),
        lore: buildEntityLore(entity)
      };
      registerEntry('entities', alias.alias, entry);
    });

    surnameCandidates.forEach((matches, trailing) => {
      if (matches.length !== 1) return;
      const [match] = matches;
      if (!match) return;
      if (match.bucket === 'characters') {
        characterEntries.push([trailing, match.entry]);
      } else {
        entityEntries.push([trailing, match.entry]);
      }
    });

    return {
      characters: Object.fromEntries(characterEntries),
      entities: Object.fromEntries(entityEntries)
    };
  }, [
    activeProject,
    aliases,
    categories,
    characters,
    characterSheets,
    entities,
    resolveCharacterBlock,
    resolveItemBlock,
    systemHistoryEntries
  ]);
}
