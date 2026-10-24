import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {isCharacterCategory} from '../worldBible/worldBibleSummary';
import type {ConsistencyAlias} from '../storage';
import {withNumberVariants} from './numberVariants';

export interface KnownLoreHighlight {
  id: string;
  surface: string;
  type: 'entity';
}

/**
 * Surfaces the manuscript editor highlights as known canon: every World Bible
 * record name and entity alias. Races, places, factions, and items also
 * highlight in the other number ("Dhemons" <-> "Dhemon"); character names stay
 * exact. Exact names and aliases always win over variants.
 */
export const buildKnownLoreHighlights = (params: {
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  categories: EntityCategory[];
}): KnownLoreHighlight[] => {
  const entityById = new Map(params.entities.map((entity) => [entity.id, entity]));
  const highlights: KnownLoreHighlight[] = params.entities.map((entity) => ({
    id: entity.id,
    surface: entity.name,
    type: 'entity'
  }));

  params.aliases.forEach((alias) => {
    if ((alias.targetType ?? 'entity') !== 'entity') return;
    const entity = entityById.get(alias.targetId);
    if (!entity) return;
    highlights.push({id: entity.id, surface: alias.alias, type: 'entity'});
  });

  const characterCategoryIds = new Set(
    params.categories.filter(isCharacterCategory).map((category) => category.id)
  );
  return withNumberVariants(highlights, (highlight) => {
    const entity = entityById.get(highlight.id);
    return Boolean(entity && !characterCategoryIds.has(entity.categoryId));
  });
};
