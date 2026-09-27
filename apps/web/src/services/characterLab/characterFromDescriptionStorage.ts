import {saveEntity} from '../../entityStorage';
import {saveLoreDocument, saveLoreDocumentLinks} from '../../loreStorage';
import {saveLoreFactProposal} from '../lore/loreFactStorage';
import type {RAGProvider} from '../rag/RAGService';
import {buildWorldBibleEntityContent} from '../worldBible/worldBibleEntityHelpers';
import type {CharacterFromDescriptionRecords} from './characterFromDescription';

/**
 * Saves records the author accepted from a rough description. Order keeps any
 * partial failure safe: a draft character alone, or a note without proposals,
 * is ordinary unreviewed material. Proposals enter the existing fact review.
 */
export async function saveCharacterFromDescription(
  records: CharacterFromDescriptionRecords,
  params: {ragService: RAGProvider | null; categorySlug?: string}
): Promise<void> {
  if (records.entity) {
    await saveEntity(records.entity);
  }
  await saveLoreDocument(records.note);
  await saveLoreDocumentLinks([records.link]);
  for (const proposal of records.proposals) {
    await saveLoreFactProposal(proposal);
  }

  const {ragService} = params;
  if (!ragService) return;
  if (records.entity) {
    await ragService.indexDocument(
      records.entity.id,
      records.entity.name,
      buildWorldBibleEntityContent(records.entity),
      'worldbible',
      {tags: params.categorySlug ? [params.categorySlug] : [], entityIds: [records.entity.id]}
    );
  }
  await ragService.indexDocument(`lore:${records.note.id}`, records.note.title, records.note.content, 'lore', {
    tags: [records.note.kind, 'lore'],
    entityIds: [records.link.targetId]
  });
}
