import {describe, expect, it} from 'vitest';
import type {
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  WorldEntity
} from '../../entityTypes';
import {
  mapCategoryToLens,
  summarizeLens,
  summarizeOtherRecords
} from './worldCanvasDerived';

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
});
