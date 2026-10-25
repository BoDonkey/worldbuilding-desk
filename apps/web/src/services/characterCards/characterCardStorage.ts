import {
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  putEntityInTransaction,
  putLoreDocumentInTransaction,
  putLoreDocumentLinksInTransaction,
  runProjectWriteTransaction
} from '../storage';
import type {RAGProvider} from '../rag/RAGService';
import {buildWorldBibleEntityContent} from '../worldBible/worldBibleEntityHelpers';
import type {CharacterCardImportRecords} from './characterCardImport';

/**
 * Saves an imported card in one write: the draft character (if new), the card
 * note, the lorebook notes, and their links commit together or not at all.
 * Search indexing follows the commit and never blocks the import.
 */
export async function saveCharacterCardImport(
  records: CharacterCardImportRecords,
  params: {ragService: RAGProvider | null; categorySlug?: string}
): Promise<void> {
  const notes = [records.cardNote, ...records.lorebookNotes];
  await runProjectWriteTransaction(
    [ENTITY_STORE_NAME, LORE_DOCUMENT_STORE_NAME, LORE_DOCUMENT_LINK_STORE_NAME],
    async (tx) => {
      if (records.entity) await putEntityInTransaction(tx, records.entity);
      for (const note of notes) await putLoreDocumentInTransaction(tx, note);
      await putLoreDocumentLinksInTransaction(tx, records.links);
    }
  );

  const {ragService} = params;
  if (!ragService) return;
  const targetId = records.links[0]?.targetId;
  try {
    if (records.entity) {
      await ragService.indexDocument(
        records.entity.id,
        records.entity.name,
        buildWorldBibleEntityContent(records.entity),
        'worldbible',
        {tags: params.categorySlug ? [params.categorySlug] : [], entityIds: [records.entity.id]}
      );
    }
    for (const note of notes) {
      await ragService.indexDocument(`lore:${note.id}`, note.title, note.content, 'lore', {
        tags: [note.kind, 'lore'],
        entityIds: targetId ? [targetId] : []
      });
    }
  } catch {
    // Search catches up on its next rebuild; the import itself is saved.
  }
}
