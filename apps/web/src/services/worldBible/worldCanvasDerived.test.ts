import {describe, expect, it} from 'vitest';
import type {
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  WorldEntity
} from '../../entityTypes';
import {
  deriveWorldCanvasReferencePalette,
  mapCategoryToLens,
  summarizeLens,
  summarizeOtherRecords
} from './worldCanvasDerived';
import {createEmptyWorldCanvas, linkSketchEntity, openLens} from './worldCanvasService';

const category = (
  id: string,
  slug: string,
  kind: EntityCategory['kind'] = 'general',
  recordType?: EntityCategory['recordType']
): EntityCategory => ({
  id,
  projectId: 'project-1',
  kind,
  recordType,
  name: slug,
  slug,
  fieldSchema: [],
  createdAt: 1
});

const entity = (
  id: string,
  categoryId: string,
  name: string,
  needsCompletion = false
): WorldEntity => ({
  id,
  projectId: 'project-1',
  categoryId,
  name,
  fields: {},
  needsCompletion,
  links: [],
  createdAt: 1,
  updatedAt: 1
});

const note = (id: string, title: string, kind: LoreDocument['kind']): LoreDocument => ({
  id,
  projectId: 'project-1',
  title,
  kind,
  format: 'plain_text',
  content: '',
  source: {type: 'manual'},
  status: 'active',
  createdAt: 1,
  updatedAt: 1
});

const link = (id: string, loreDocumentId: string, targetId: string): LoreDocumentLink => ({
  id,
  projectId: 'project-1',
  loreDocumentId,
  targetType: 'entity',
  targetId,
  relationship: 'primary_subject',
  createdAt: 1
});

describe('worldCanvasDerived', () => {
  it('maps only the specified category semantics and leaves custom categories visible as other', () => {
    const categories = [
      category('characters', 'cast', 'character'),
      category('places', 'story-regions'),
      category('factions', 'rival-guilds'),
      category('relics', 'relics')
    ];
    expect(categories.map(mapCategoryToLens)).toEqual([
      'people', 'places', 'factions', null
    ]);
    expect(summarizeOtherRecords({
      categories,
      entities: [entity('key', 'relics', 'Emberglass Key')]
    })).toEqual(['Emberglass Key']);
  });

  it('summarizes mapped records and Source Notes by kind and record link', () => {
    const categories = [category('characters', 'characters', 'character')];
    const entities = [
      entity('brannic', 'characters', 'Brannic Halloway'),
      entity('sera', 'characters', 'Sera Kestrel')
    ];
    const loreDocuments = [
      note('sera-note', 'Character Dossier — Sera Kestrel', 'character_dossier'),
      note('linked-note', 'Brannic at the Salt Door', 'general_lore')
    ];
    expect(summarizeLens(
      {kind: 'people'},
      {
        categories,
        entities,
        loreDocuments,
        links: [link('link-1', 'linked-note', 'brannic')]
      }
    )).toEqual({
      recordNames: ['Brannic Halloway', 'Sera Kestrel'],
      recordCount: 2,
      sourceNoteTitles: ['Brannic at the Salt Door', 'Character Dossier — Sera Kestrel'],
      sourceNoteCount: 2
    });
  });

  it('excludes mechanics-only records from general-fiction derived summaries', () => {
    const mechanics = category(
      'mechanics',
      'problems-power-cannot-solve',
      'general',
      'system-negative-space'
    );
    const categories = [mechanics];
    expect(summarizeOtherRecords({
      categories,
      entities: [entity('problem', mechanics.id, 'Magic debt')],
      isGeneralFiction: true
    })).toEqual([]);
  });

  it('separates author pins from deterministic suggestions and dedupes linked notes', () => {
    const categories = [
      category('characters', 'characters', 'character'),
      category('factions', 'factions')
    ];
    const entities = [
      entity('sera', 'characters', 'Sera Kestrel'),
      entity('compact', 'factions', 'The Cinder Compact')
    ];
    const documents = [note('compact-note', 'Compact Notes', 'faction_notes')];
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'people');
    canvas = linkSketchEntity(canvas, 'people', canvas.lenses[0].activeSketchId, 'sera');

    const palette = deriveWorldCanvasReferencePalette(canvas, {
      categories,
      entities,
      loreDocuments: documents,
      links: [link('compact-link', 'compact-note', 'compact')]
    });

    expect(palette.pinned).toEqual([
      expect.objectContaining({id: 'sera', label: 'Sera Kestrel', provenance: 'author-pinned', lensKinds: ['people']})
    ]);
    expect(palette.suggested.filter((item) => item.id === 'compact-note')).toHaveLength(1);
    expect(palette.suggested).toEqual(expect.arrayContaining([
      expect.objectContaining({id: 'compact', sourceType: 'world-bible', lensKinds: ['factions']}),
      expect.objectContaining({id: 'compact-note', sourceType: 'source-note', lensKinds: ['factions']})
    ]));
    expect(palette.suggested.some((item) => item.id === 'sera')).toBe(false);
  });

  it('uses live names, preserves stale pins, and browses custom categories separately', () => {
    const categories = [category('relics', 'relics')];
    const canvas = {
      ...createEmptyWorldCanvas('project-1'),
      coreIdeaEntityId: 'deleted-entity',
      coreIdeaSourceNoteId: 'renamed-note'
    };
    const palette = deriveWorldCanvasReferencePalette(canvas, {
      categories,
      entities: [entity('key', 'relics', 'Emberglass Key')],
      loreDocuments: [note('renamed-note', 'The New Note Title', 'general_lore')],
      links: []
    });

    expect(palette.pinned).toEqual(expect.arrayContaining([
      expect.objectContaining({id: 'deleted-entity', label: 'No longer exists', existence: 'missing'}),
      expect.objectContaining({id: 'renamed-note', label: 'The New Note Title', existence: 'available'})
    ]));
    expect(palette.browse).toEqual([
      expect.objectContaining({id: 'key', label: 'Emberglass Key', provenance: 'unclassified'})
    ]);
  });

  it('filters mechanics-only suggestions from general-fiction projects', () => {
    const mechanics = category('mechanics', 'problems-power-cannot-solve', 'general', 'system-negative-space');
    const palette = deriveWorldCanvasReferencePalette(createEmptyWorldCanvas('project-1'), {
      categories: [mechanics],
      entities: [entity('problem', mechanics.id, 'Magic debt')],
      loreDocuments: [],
      links: [],
      isGeneralFiction: true
    });
    expect(palette.suggested).toEqual([]);
    expect(palette.browse).toEqual([]);
  });
});
