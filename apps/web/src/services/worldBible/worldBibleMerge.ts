import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {
  deleteAliasesForEntity,
  deleteEntity,
  getStateMutationEventsByProject,
  moveEntityImages,
  saveEntity,
  saveStateMutationEvents,
  type ConsistencyAlias
} from '../storage';
import {planPlaceMerge} from './placeMerge';
import {saveWorldBibleRecord, type WorldBibleIndexing} from './worldBibleRecordSave';

/**
 * Saves a merge of `source` into the record `merged` (the target as it
 * should save): the target and its aliases through `saveWorldBibleRecord`,
 * place references moved from the source to the target (`planPlaceMerge`),
 * then the source removed with its aliases, search entry, and memories.
 * The source's images move to the target; the target keeps its own portrait,
 * or takes the source's when it has none (4.100).
 * The place plan runs before any write, so a refused merge changes nothing.
 */
export async function saveWorldBibleMerge(params: {
  source: WorldEntity;
  merged: WorldEntity;
  aliases: string[];
  categories: EntityCategory[];
  entities: WorldEntity[];
  indexing: WorldBibleIndexing;
}): Promise<{entity: WorldEntity; aliases: ConsistencyAlias[]; repointed: WorldEntity[]}> {
  const {source, categories, indexing} = params;
  const projectId = params.merged.projectId;
  const category = categories.find((candidate) => candidate.id === params.merged.categoryId);
  if (!category) throw new Error('The merged record has no category.');
  const plan = planPlaceMerge({
    source,
    target: params.merged,
    categories,
    entities: params.entities,
    events: await getStateMutationEventsByProject(projectId)
  });
  const target =
    !plan.target.portrait && source.portrait ? {...plan.target, portrait: source.portrait} : plan.target;
  const repointedById = new Map(plan.entities.map((entity) => [entity.id, entity]));
  const entitiesAfter = params.entities
    .filter((entity) => entity.id !== source.id)
    .map((entity) =>
      entity.id === target.id ? target : repointedById.get(entity.id) ?? entity
    );

  const saved = await saveWorldBibleRecord({
    entity: target,
    category,
    categories,
    entities: entitiesAfter,
    aliases: params.aliases,
    indexing
  });
  // Place data is not part of a record's search content; no re-index needed.
  for (const entity of plan.entities) await saveEntity(entity);
  await saveStateMutationEvents(plan.events);
  await moveEntityImages(projectId, source.id, target.id);
  await deleteAliasesForEntity(projectId, source.id);
  await deleteEntity(source.id);
  await indexing.ragService?.deleteDocument(source.id);
  await indexing.shodhService?.deleteMemoriesForDocument(source.id);
  return {entity: saved.entity, aliases: saved.aliases, repointed: plan.entities};
}
