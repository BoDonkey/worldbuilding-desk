import type {LoreDocument, LoreDocumentLink} from '../../entityTypes';
import {replaceLoreDocumentLinks, saveLoreDocument} from '../../loreStorage';
import type {RAGProvider} from '../rag/RAGService';
import {describeError} from '../errors';
import {parseLoreImport} from './loreImport';
import {summarizeContent} from './sourceNoteCapture';

export type SourceNoteImportStatus = 'waiting' | 'imported' | 'skipped' | 'failed';

export interface SourceNoteImportResult {
  fileName: string;
  status: SourceNoteImportStatus;
  /** The new note, or for a skipped file the note it was already imported as. */
  documentId?: string;
  reason?: string;
}

export interface SourceNoteBatchLink {
  targetType: LoreDocumentLink['targetType'];
  targetId: string;
}

/** Shared with the manual save so a batch note is indexed exactly like one saved by hand. */
export async function indexSourceNote(
  ragService: RAGProvider | null,
  document: LoreDocument,
  links: LoreDocumentLink[]
): Promise<void> {
  if (!ragService) return;
  await ragService.indexDocument(`lore:${document.id}`, document.title, document.content, 'lore', {
    tags: [document.kind, 'lore'],
    entityIds: links.map((link) => link.targetId)
  });
}

/** The note a file was already imported as, matched by file name ignoring case. */
export const findImportedSourceNote = (
  documents: LoreDocument[],
  fileName: string
): LoreDocument | undefined => {
  const key = fileName.trim().toLowerCase();
  return documents.find(
    (document) =>
      document.source.type === 'import' && document.source.fileName.trim().toLowerCase() === key
  );
};

/**
 * Saves each file as its own Source Note, one at a time. A file already
 * imported (by an existing note or earlier in this batch) is skipped, and a
 * file that cannot be read fails without stopping the rest. Source Notes are
 * never canon; nothing is extracted here.
 */
export async function importSourceNoteFiles(params: {
  projectId: string;
  files: File[];
  existingDocuments: LoreDocument[];
  link: SourceNoteBatchLink | null;
  ragService: RAGProvider | null;
  onResult: (index: number, result: SourceNoteImportResult) => void;
}): Promise<SourceNoteImportResult[]> {
  const {projectId, files, link, ragService, onResult} = params;
  const known = [...params.existingDocuments];
  const results: SourceNoteImportResult[] = [];

  for (const [index, file] of files.entries()) {
    const existing = findImportedSourceNote(known, file.name);
    let result: SourceNoteImportResult;
    if (existing) {
      result = {
        fileName: file.name,
        status: 'skipped',
        documentId: existing.id,
        reason: `Already imported as "${existing.title}".`
      };
    } else {
      try {
        const parsed = await parseLoreImport(file);
        const now = Date.now();
        const document: LoreDocument = {
          id: crypto.randomUUID(),
          projectId,
          title: parsed.title,
          kind: 'general_lore',
          format: parsed.format,
          content: parsed.content,
          summary: summarizeContent(parsed.content),
          source: {type: 'import', fileName: parsed.fileName, mimeType: parsed.mimeType},
          status: 'active',
          createdAt: now,
          updatedAt: now
        };
        const links: LoreDocumentLink[] = link
          ? [
              {
                id: crypto.randomUUID(),
                projectId,
                loreDocumentId: document.id,
                targetType: link.targetType,
                targetId: link.targetId,
                relationship: 'primary_subject',
                createdAt: now
              }
            ]
          : [];
        await saveLoreDocument(document);
        await replaceLoreDocumentLinks({loreDocumentId: document.id, links});
        known.push(document);
        // The note is saved; a retrieval-index failure must not report it as not imported.
        const indexed = await indexSourceNote(ragService, document, links).then(
          () => true,
          () => false
        );
        result = {
          fileName: file.name,
          status: 'imported',
          documentId: document.id,
          ...(indexed ? {} : {reason: 'Saved, but not yet indexed for retrieval. Use Rebuild Context to index it.'})
        };
      } catch (error) {
        result = {
          fileName: file.name,
          status: 'failed',
          reason: describeError(error, 'Could not read this file.')
        };
      }
    }
    results.push(result);
    onResult(index, result);
  }
  return results;
}
