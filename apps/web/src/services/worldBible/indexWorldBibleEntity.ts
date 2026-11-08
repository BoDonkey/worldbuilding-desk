import type {WorldEntity} from '../../entityTypes';
import type {RAGProvider} from '../rag/RAGService';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {buildWorldBibleEntityContent} from './worldBibleEntityHelpers';

/**
 * Makes a saved World Bible record findable: indexes it for retrieval and
 * captures its canon memory. Either service may be unavailable.
 */
export async function indexWorldBibleEntity(
  entity: WorldEntity,
  categorySlug: string,
  {ragService, shodhService}: {ragService: RAGProvider | null; shodhService: ShodhMemoryProvider | null}
): Promise<void> {
  const content = buildWorldBibleEntityContent(entity);
  if (ragService) {
    await ragService.indexDocument(
      entity.id,
      entity.name,
      content,
      'worldbible',
      {
        tags: [categorySlug],
        entityIds: [entity.id]
      }
    );
  }
  if (shodhService) {
    await shodhService.captureAutoMemory({
      projectId: entity.projectId,
      documentId: entity.id,
      title: entity.name,
      content,
      tags: ['worldbible', categorySlug]
    });
  }
}
