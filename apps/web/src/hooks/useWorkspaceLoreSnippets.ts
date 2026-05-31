import {useMemo} from 'react';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  EntityCategory,
  ProjectSettings,
  StatBlockStyle,
  SystemHistoryEntry,
  WorldEntity
} from '../entityTypes';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import type {ConsistencyAlias} from '../services/consistency';
import type {Project} from '../entityTypes';
import {getCachedSynopsis, setCachedSynopsis} from '../services/editor';
import {getProjectCapabilities} from '../projectMode';

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
  canonicalFacts: CanonicalFact[];
  aliases: ConsistencyAlias[];
  systemHistoryEntries: SystemHistoryEntry[];
  projectSettings: ProjectSettings | null;
  resolveCharacterBlock: (sheet: CharacterSheet, style: StatBlockStyle) => string;
  resolveItemBlock: (entity: WorldEntity, style: StatBlockStyle) => string;
}

export function useWorkspaceLoreSnippets({
  activeProject,
  categories,
  characters,
  characterSheets,
  entities,
  canonicalFacts,
  aliases,
  systemHistoryEntries,
  projectSettings,
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
    const characterCategoryIds = new Set(
      categories
        .filter((category) => category.slug.toLowerCase().includes('character'))
        .map((category) => category.id)
    );
    const characterById = new Map(characters.map((character) => [character.id, character]));
    const shouldUseCharacterToolsAsCanon =
      !getProjectCapabilities(projectSettings).isGeneralFiction;
    const characterSheetByCharacterId = new Map(
      characterSheets
        .filter((sheet): sheet is CharacterSheet & {characterId: string} => Boolean(sheet.characterId))
        .map((sheet) => [sheet.characterId, sheet])
    );
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const linkedCharacterIdByEntityId = new Map<string, string>();
    const linkedEntityIdByCharacterId = new Map<string, string>();
    entities.forEach((entity) => {
      if (!characterCategoryIds.has(entity.categoryId)) {
        return;
      }
      const normalizedEntityName = normalize(entity.name);
      const matchingCharacter = characters.find(
        (character) => normalize(character.name) === normalizedEntityName
      );
      if (matchingCharacter) {
        linkedCharacterIdByEntityId.set(entity.id, matchingCharacter.id);
        linkedEntityIdByCharacterId.set(matchingCharacter.id, entity.id);
      }
    });
    const canonicalFactsByTarget = new Map<string, CanonicalFact[]>();
    canonicalFacts.forEach((fact) => {
      const key = `${fact.targetType}:${fact.targetId}`;
      const current = canonicalFactsByTarget.get(key) ?? [];
      current.push(fact);
      canonicalFactsByTarget.set(key, current);
    });

    const factSummaryLines = (targetType: 'character' | 'entity', targetId: string): string[] =>
      (canonicalFactsByTarget.get(`${targetType}:${targetId}`) ?? [])
        .slice(0, 4)
        .map((fact) => {
          const value =
            typeof fact.value === 'string'
              ? fact.value
              : `${fact.value.label}: ${fact.value.value}`;
          return `${fact.factType.replace(/_/g, ' ')}: ${value}`;
        });

    const recentSystemMessageFor = (name: string): string => {
      const normalized = name.trim().toLowerCase();
      const match = systemHistoryEntries.find((entry) =>
        entry.message.toLowerCase().includes(normalized)
      );
      return match?.message ?? 'No recent linked system event.';
    };

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

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

    const buildCharacterLoreFromCharacter = (character: Character): LoreInspectorRecord => {
      const role =
        typeof character.fields.role === 'string' && character.fields.role.trim()
          ? character.fields.role.trim()
          : 'Role not set';
      const age =
        typeof character.fields.age === 'string' && character.fields.age.trim()
          ? character.fields.age.trim()
          : 'Age not set';
      const notes =
        typeof character.fields.notes === 'string' && character.fields.notes.trim()
          ? character.fields.notes.trim()
          : 'No notes captured yet.';
      const canonicalLines = factSummaryLines('character', character.id);
      const cached = getCachedSynopsis(activeProject.id, character.id, character.updatedAt);
      const synopsis =
        cached ??
        {
          goal:
            (typeof character.fields.goal === 'string' && character.fields.goal.trim()) ||
            'No explicit active goal recorded.',
          recentEvent: recentSystemMessageFor(character.name),
          motivation:
            (typeof character.fields.motivation === 'string' &&
              character.fields.motivation.trim()) ||
            character.description?.trim() ||
            canonicalLines[0] ||
            notes
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, character.id, character.updatedAt, synopsis);
      }
      return {
        type: 'character',
        id: character.id,
        name: character.name,
        vitalSigns: [role, `Age: ${age}`, ...canonicalLines.slice(0, 2)],
        synopsis
      };
    };

    const buildCharacterSnippetFromCharacter = (character: Character): string => {
      const lines = [
        `<p><strong>${escapeHtml(character.name)}</strong></p>`
      ];
      if (character.description?.trim()) {
        lines.push(`<p>${escapeHtml(character.description.trim())}</p>`);
      }
      if (typeof character.fields.role === 'string' && character.fields.role.trim()) {
        lines.push(`<p><strong>Role:</strong> ${escapeHtml(character.fields.role.trim())}</p>`);
      }
      if (typeof character.fields.notes === 'string' && character.fields.notes.trim()) {
        lines.push(`<p>${escapeHtml(character.fields.notes.trim())}</p>`);
      }
      factSummaryLines('character', character.id).forEach((line) => {
        lines.push(`<p><strong>Canon:</strong> ${escapeHtml(line)}</p>`);
      });
      return lines.join('');
    };

    const buildEntityLore = (entity: WorldEntity): LoreInspectorRecord => {
      const categoryName = categoryNameById.get(entity.categoryId) ?? 'Entity';
      const status =
        typeof entity.fields.status === 'string' && entity.fields.status.trim()
          ? entity.fields.status.trim()
          : 'State unknown';
      const canonicalLines = factSummaryLines('entity', entity.id);
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
            canonicalLines[0] ||
            'No motivation/secret recorded.'
        };
      if (!cached) {
        setCachedSynopsis(activeProject.id, entity.id, entity.updatedAt, synopsis);
      }
      return {
        type: 'entity',
        id: entity.id,
        name: entity.name,
        vitalSigns: [categoryName, status, ...canonicalLines.slice(0, 2)],
        synopsis
      };
    };

    const characterEntries: Array<[string, SnippetEntry]> = [];
    const entityEntries: Array<[string, SnippetEntry]> = [];
    const explicitCharacterKeys = new Set<string>();
    const explicitEntityKeys = new Set<string>();
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
        explicitCharacterKeys.add(key);
      } else {
        entityEntries.push([key, indexedEntry]);
        explicitEntityKeys.add(key);
      }

      const tokens = label.trim().split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return;
      const trailing = normalize(tokens[tokens.length - 1] ?? '');
      if (!trailing || trailing.length < 4) return;
      const existing = surnameCandidates.get(trailing) ?? [];
      existing.push({bucket, entry: indexedEntry});
      surnameCandidates.set(trailing, existing);
    };

    if (shouldUseCharacterToolsAsCanon) {
      characterSheets.forEach((sheet) => {
        const entry = {
          name: sheet.name,
          html: resolveCharacterBlock(sheet, 'compact'),
          lore: buildCharacterLore(sheet)
        };
        registerEntry('characters', sheet.name, entry);
      });

      characters.forEach((character) => {
        if (characterSheetByCharacterId.has(character.id)) {
          return;
        }
        const entry = {
          name: character.name,
          html: buildCharacterSnippetFromCharacter(character),
          lore: buildCharacterLoreFromCharacter(character)
        };
        registerEntry('characters', character.name, entry);
      });
    }

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
        if (linkedEntityIdByCharacterId.has(alias.targetId)) {
          return;
        }
        if (!shouldUseCharacterToolsAsCanon) {
          return;
        }
        const sheet = characterSheetByCharacterId.get(alias.targetId);
        const character = characterById.get(alias.targetId);
        if (!sheet && !character) return;
        const entry = sheet
          ? {
              name: sheet.name,
              html: resolveCharacterBlock(sheet, 'compact'),
              lore: buildCharacterLore(sheet)
            }
          : {
              name: character!.name,
              html: buildCharacterSnippetFromCharacter(character!),
              lore: buildCharacterLoreFromCharacter(character!)
            };
        registerEntry('characters', alias.alias, entry);
        return;
      }
      const entity = entityById.get(alias.targetId);
      if (!entity) return;
      const linkedCharacterId = linkedCharacterIdByEntityId.get(entity.id);
      if (linkedCharacterId) {
        const sheet = characterSheetByCharacterId.get(linkedCharacterId);
        const character = characterById.get(linkedCharacterId);
        if (!sheet && !character) return;
        const entry = sheet
          ? {
              name: sheet.name,
              html: resolveCharacterBlock(sheet, 'compact'),
              lore: buildCharacterLore(sheet)
            }
          : {
              name: character!.name,
              html: buildCharacterSnippetFromCharacter(character!),
              lore: buildCharacterLoreFromCharacter(character!)
            };
        registerEntry('characters', alias.alias, entry);
        return;
      }
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
        if (explicitCharacterKeys.has(trailing)) {
          return;
        }
        characterEntries.push([trailing, match.entry]);
      } else {
        if (explicitEntityKeys.has(trailing)) {
          return;
        }
        entityEntries.push([trailing, match.entry]);
      }
    });

    return {
      characters: Object.fromEntries(characterEntries),
      entities: Object.fromEntries(entityEntries)
    };
  }, [
    activeProject,
    canonicalFacts,
    aliases,
    categories,
    characters,
    characterSheets,
    entities,
    projectSettings,
    resolveCharacterBlock,
    resolveItemBlock,
    systemHistoryEntries
  ]);
}
