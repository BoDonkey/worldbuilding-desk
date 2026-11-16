import {describe, expect, it} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {planPortableWorldBibleRecord, type PortableImportDraft} from './portableImport';

const category: EntityCategory = {
  id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations',
  fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}], createdAt: 0
};

const draft: PortableImportDraft = {
  id: 'draft-1',
  fileName: 'Harbor.md',
  relativePath: 'Harbor.md',
  title: 'Harbor',
  destination: 'world-bible',
  content: 'Where the ships come in.',
  frontmatter: {aliases: ['The Docks', 'Old Port']},
  wikilinks: [],
  include: true,
  categoryId: 'cat-loc',
  wikiLinkActions: {}
};

describe('planPortableWorldBibleRecord', () => {
  it('stores aliases no other record answers to, and keeps all of them in the field (3.45)', () => {
    const existing: WorldEntity = {
      id: 'port', projectId: 'p', categoryId: 'cat-loc', name: 'Old Port', fields: {}, links: [],
      createdAt: 0, updatedAt: 0
    };
    const aliases: ConsistencyAlias[] = [];
    const plan = planPortableWorldBibleRecord({
      draft, category, projectId: 'p', linkedEntityIds: [], entities: [existing], aliases, now: 1
    });

    expect(plan.aliases).toEqual(['The Docks']);
    expect(plan.entity.fields.alternativeNames).toBe('The Docks, Old Port');
    expect(plan.entity).toMatchObject({name: 'Harbor', isNew: true, needsCompletion: true});
  });
});
