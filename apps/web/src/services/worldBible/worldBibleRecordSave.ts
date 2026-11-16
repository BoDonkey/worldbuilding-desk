import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {RAGProvider} from '../rag/RAGService';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {replaceAliasesForEntity, saveEntity, type ConsistencyAlias} from '../storage';
import {indexWorldBibleEntity} from './indexWorldBibleEntity';
import {isLocationCategory} from './locationCategory';
import {normalizePlaceData, placesById, withPlaceData} from './places';

/**
 * One way to save a World Bible record (3.45): place rules, the save, the
 * record's aliases, and search indexing. Every path that creates or rewrites
 * a record calls `saveWorldBibleRecord`, so a record made from the Workspace,
 * the place queue, an import, or an accepted proposal is findable at once.
 */

/** Search and memory services; either may be unavailable. */
export type WorldBibleIndexing = {
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
};

/**
 * The record as it should save. A record in a location category keeps place
 * data only after the place rules (`normalizePlaceData`): links to missing
 * places dropped, a parent that would make a cycle refused (throws). Other
 * records keep what they carry.
 */
export function applyWorldBibleRecordRules(
  entity: WorldEntity,
  params: {category: EntityCategory; categories: EntityCategory[]; entities: WorldEntity[]}
): WorldEntity {
  if (!isLocationCategory(params.category) || !entity.place) return entity;
  return withPlaceData(
    entity,
    normalizePlaceData(entity.id, entity.place, placesById(params.categories, params.entities))
  );
}

/**
 * Indexes saved records for search and memory. Never throws: the records are
 * already saved, and search catches up on its next rebuild. Returns whether
 * every record was indexed.
 */
export async function indexWorldBibleRecords(
  records: Array<{entity: WorldEntity; categorySlug: string}>,
  indexing: WorldBibleIndexing
): Promise<boolean> {
  let indexed = true;
  for (const {entity, categorySlug} of records) {
    try {
      await indexWorldBibleEntity(entity, categorySlug, indexing);
    } catch {
      indexed = false;
    }
  }
  return indexed;
}

export async function saveWorldBibleRecord(params: {
  entity: WorldEntity;
  category: EntityCategory;
  /** The project's categories and records, for the place rules. */
  categories: EntityCategory[];
  entities: WorldEntity[];
  /** The record's full alias list; it replaces what is stored. Omit to leave aliases alone. */
  aliases?: string[];
  indexing: WorldBibleIndexing;
}): Promise<{entity: WorldEntity; aliases: ConsistencyAlias[]; indexed: boolean}> {
  const entity = applyWorldBibleRecordRules(params.entity, params);
  await saveEntity(entity);
  const aliases = params.aliases
    ? await replaceAliasesForEntity({
        projectId: entity.projectId,
        entityId: entity.id,
        aliases: params.aliases
      })
    : [];
  const indexed = await indexWorldBibleRecords(
    [{entity, categorySlug: params.category.slug}],
    params.indexing
  );
  return {entity, aliases, indexed};
}
