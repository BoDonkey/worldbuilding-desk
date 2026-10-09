import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LoreDocument} from '../../entityTypes';
import {getLoreDocumentLinksByProject, getLoreDocumentsByProject} from '../../loreStorage';
import type {RAGProvider} from '../rag/RAGService';
import {findImportedSourceNote, importSourceNoteFiles} from './sourceNoteBatchImport';

const projectId = `batch-project-${Math.random().toString(36).slice(2)}`;

const existing: LoreDocument = {
  id: 'existing-note',
  projectId,
  title: 'Camila',
  kind: 'general_lore',
  format: 'markdown',
  content: '# Camila',
  source: {type: 'import', fileName: 'Camila.md'},
  status: 'active',
  createdAt: 1,
  updatedAt: 1
};

const file = (name: string, text: string) => new File([text], name, {type: 'text/plain'});

let rag: {indexDocument: ReturnType<typeof vi.fn>};
beforeEach(() => {
  rag = {indexDocument: vi.fn().mockResolvedValue(undefined)};
});

describe('findImportedSourceNote', () => {
  it('matches imported notes by file name ignoring case, never manual notes', () => {
    const manual = {...existing, id: 'manual', source: {type: 'manual' as const}};
    expect(findImportedSourceNote([manual, existing], ' camila.MD ')?.id).toBe('existing-note');
    expect(findImportedSourceNote([manual], 'Camila.md')).toBeUndefined();
  });
});

describe('importSourceNoteFiles', () => {
  it('saves each new file, skips duplicates, and keeps going past a failure', async () => {
    const onResult = vi.fn();
    const results = await importSourceNoteFiles({
      projectId,
      files: [
        file('camila.md', '# Again'),
        file('Leo.md', '## Background\n\n- **Age:** 40'),
        file('broken.docx', 'not a zip'),
        file('Empty.txt', '   '),
        file('Races.txt', 'Plain notes'),
        file('LEO.md', 'Second copy in the same batch')
      ],
      existingDocuments: [existing],
      link: {targetType: 'entity', targetId: 'entity-leo'},
      ragService: rag as unknown as RAGProvider,
      onResult
    });

    expect(results.map((result) => [result.fileName, result.status])).toEqual([
      ['camila.md', 'skipped'],
      ['Leo.md', 'imported'],
      ['broken.docx', 'failed'],
      ['Empty.txt', 'failed'],
      ['Races.txt', 'imported'],
      ['LEO.md', 'skipped']
    ]);
    expect(results[0]).toMatchObject({documentId: 'existing-note', reason: 'Already imported as "Camila".'});
    expect(results[2].reason).toMatch(/DOCX/);
    expect(results[3].reason).toBe('Imported file was empty.');
    expect(results[5].documentId).toBe(results[1].documentId);
    expect(onResult).toHaveBeenCalledTimes(6);

    const saved = await getLoreDocumentsByProject(projectId);
    expect(saved.map((document) => [document.title, document.format, document.source]).sort()).toEqual([
      ['Leo', 'markdown', {type: 'import', fileName: 'Leo.md', mimeType: 'text/plain'}],
      ['Races', 'plain_text', {type: 'import', fileName: 'Races.txt', mimeType: 'text/plain'}]
    ]);
    const links = await getLoreDocumentLinksByProject(projectId);
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.targetId === 'entity-leo' && link.relationship === 'primary_subject')).toBe(true);
    expect(rag.indexDocument).toHaveBeenCalledTimes(2);
    expect(rag.indexDocument).toHaveBeenCalledWith(
      `lore:${results[1].documentId}`,
      'Leo',
      '## Background\n\n- **Age:** 40',
      'lore',
      {tags: ['general_lore', 'lore'], entityIds: ['entity-leo']}
    );
  });

  it('reports a saved note as imported even when indexing fails', async () => {
    rag.indexDocument.mockRejectedValue(new Error('index down'));
    const [result] = await importSourceNoteFiles({
      projectId,
      files: [file('Indexed later.md', 'Text')],
      existingDocuments: [],
      link: null,
      ragService: rag as unknown as RAGProvider,
      onResult: () => {}
    });

    expect(result.status).toBe('imported');
    expect(result.reason).toMatch(/Rebuild Context/);
    expect(await getLoreDocumentLinksByProject(projectId)).toHaveLength(2);
  });
});
