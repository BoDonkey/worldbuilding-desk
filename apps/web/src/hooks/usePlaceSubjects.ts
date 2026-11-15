import {useMemo} from 'react';
import type {CharacterSheet, EntityCategory, WorldEntity} from '../entityTypes';
import type {ConsistencyAlias} from '../services/storage';
import {buildCharacterCategoryIds} from '../services/consistency/reviewLinkOptions';
import {buildStateSubjects} from '../services/state/stateSubjects';
import {buildPlaceNameIndex} from '../services/worldBible/placePositions';

/**
 * The place name index and the characters whose positions can be replayed,
 * shared by Where is everyone (4.78) and the map surface (4.80).
 */
export function usePlaceSubjects(params: {
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characterSheets: CharacterSheet[];
}) {
  const {categories, entities, aliases, characterSheets} = params;
  const index = useMemo(
    () => buildPlaceNameIndex({categories, entities, aliases}),
    [aliases, categories, entities]
  );
  const subjects = useMemo(() => {
    const characterCategoryIds = buildCharacterCategoryIds(categories);
    return buildStateSubjects({
      characterSheets,
      characterEntities: entities.filter((entity) => characterCategoryIds.has(entity.categoryId))
    });
  }, [categories, characterSheets, entities]);
  return {index, subjects};
}
