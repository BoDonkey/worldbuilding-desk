import type {Character, CharacterSheet, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {createCharacterLinkResolver, isCharacterCategory} from './characterIdentity';
import {
  buildCharacterIdentityResolutionQueue,
  type CharacterIdentityResolutionItem
} from './characterIdentityResolution';

/** One World Bible character the author can tick for export (Slice 4.87). */
export interface CharacterExportChoice {
  entityId: string;
  name: string;
  aliases: string[];
  hasSheet: boolean;
}

export interface CharacterExportChoices {
  /** World Bible characters, by name. Their ids go to `exportCharactersJson({entityIds})`. */
  choices: CharacterExportChoice[];
  /**
   * Records still in the Needs canon link queue. They have no World Bible
   * character, so a selected export cannot include them; Export all still does.
   */
  unlinked: CharacterIdentityResolutionItem[];
}

/** What the Character packages picker lists, from the project's saved records. */
export function buildCharacterExportChoices(params: {
  projectId: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characters: Character[];
  sheets: CharacterSheet[];
  keptSeparateKeys?: string[];
}): CharacterExportChoices {
  const characterCategoryIds = new Set(
    params.categories.filter(isCharacterCategory).map((category) => category.id)
  );
  const resolver = createCharacterLinkResolver(params);
  const withSheet = new Set(
    params.sheets.flatMap((sheet) => {
      const entityId = resolver.resolveEntityId({sheetId: sheet.id, characterId: sheet.characterId});
      return entityId ? [entityId] : [];
    })
  );
  const choices = params.entities
    .filter((entity) => characterCategoryIds.has(entity.categoryId))
    .map((entity) => ({
      entityId: entity.id,
      name: entity.name.trim() || 'Unnamed character',
      aliases: params.aliases
        .filter((alias) => alias.targetType === 'entity' && alias.targetId === entity.id)
        .map((alias) => alias.alias.trim())
        .filter(Boolean),
      hasSheet: withSheet.has(entity.id)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const unlinked = buildCharacterIdentityResolutionQueue({
    projectId: params.projectId,
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.sheets,
    keptSeparateKeys: params.keptSeparateKeys
  });
  return {choices, unlinked};
}

/** Search by name or alias, ignoring case. */
export function filterCharacterExportChoices(choices: CharacterExportChoice[], query: string): CharacterExportChoice[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return choices;
  return choices.filter((choice) =>
    [choice.name, ...choice.aliases].some((value) => value.toLowerCase().includes(needle)));
}
