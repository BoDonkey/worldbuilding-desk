import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency';
import {
  buildPortableDataZip,
  parsePortableMarkdown,
  parsePortableMarkdownFiles
} from './portableData';

const category: EntityCategory = {
  id: 'category-1',
  projectId: 'project-1',
  kind: 'general',
  name: 'Locations',
  slug: 'locations',
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'climate', label: 'Climate', type: 'text'}
  ],
  createdAt: 1
};

const entity: WorldEntity = {
  id: 'entity-1',
  projectId: 'project-1',
  categoryId: category.id,
  name: 'Ember Archive',
  fields: {
    description: '<p>A library beneath the city.</p>',
    climate: 'Dry',
    alternative_names: 'The Archive'
  },
  links: ['entity-2'],
  createdAt: 1,
  updatedAt: 2
};

const linkedEntity: WorldEntity = {
  ...entity,
  id: 'entity-2',
  name: 'Glass Market',
  fields: {},
  links: []
};

const alias: ConsistencyAlias = {
  id: 'alias-1',
  projectId: 'project-1',
  targetId: entity.id,
  targetType: 'entity',
  alias: 'Old Archive',
  createdAt: 1,
  updatedAt: 1
};

const fact: CanonicalFact = {
  id: 'fact-1',
  projectId: 'project-1',
  targetType: 'entity',
  targetId: entity.id,
  factType: 'background',
  value: 'Founded after the ashfall',
  acceptedAt: 1,
  updatedAt: 1
};

const note: LoreDocument = {
  id: 'note-1',
  projectId: 'project-1',
  title: 'Archive research',
  kind: 'place_history',
  format: 'markdown',
  content: 'The [[Ember Archive]] has sealed lower stacks.',
  source: {type: 'manual'},
  status: 'active',
  createdAt: 1,
  updatedAt: 1
};

const noteLink: LoreDocumentLink = {
  id: 'link-1',
  projectId: 'project-1',
  loreDocumentId: note.id,
  targetType: 'entity',
  targetId: entity.id,
  relationship: 'primary_subject',
  createdAt: 1
};

describe('portable data export', () => {
  it('builds a readable ZIP with Markdown records, category CSV, source notes, and schema help', () => {
    const zip = buildPortableDataZip({
      categories: [category],
      entities: [entity, linkedEntity],
      aliases: [alias],
      canonicalFacts: [fact],
      loreDocuments: [note],
      loreDocumentLinks: [noteLink]
    });
    const readable = new TextDecoder().decode(zip);

    expect(readable).toContain('README.md');
    expect(readable).toContain('# SagaSpine portable data');
    expect(readable).toContain('world-bible/locations/ember-archive.md');
    expect(readable).toContain('world-bible/locations.csv');
    expect(readable).toContain('source-notes/archive-research.md');
    expect(readable).toContain('worldbuilding-desk/portable/1');
    expect(readable).toContain('Founded after the ashfall');
    expect(readable).toContain('[[Glass Market]]');
    expect(readable).toContain('Old Archive');
  });
});

describe('portable Markdown import', () => {
  it('maps exported frontmatter and wikilinks without accepting them automatically', () => {
    const draft = parsePortableMarkdown(
      `---\ntype: "world-bible-record"\ntitle: "Mira Voss"\ncategory: "Characters"\naliases: ["The Fox"]\nlinks: ["Glass Market"]\nfields: {"description":"A courier."}\n---\n# Mira Voss\n\nShe visits [[Ember Archive|the archive]].`,
      'mira.md'
    );

    expect(draft.destination).toBe('world-bible');
    expect(draft.title).toBe('Mira Voss');
    expect(draft.frontmatter.aliases).toEqual(['The Fox']);
    expect(draft.frontmatter.fields).toEqual({description: 'A courier.'});
    expect(draft.wikilinks).toEqual(['Glass Market', 'Ember Archive']);
  });

  it('defaults arbitrary vault notes to non-canon Source Notes and skips non-Markdown files', async () => {
    const markdown = new File(['# Rumors\n\nA lead about [[Mira]].'], 'rumors.md', {
      type: 'text/markdown'
    });
    const image = new File(['not an image'], 'map.png', {type: 'image/png'});

    const drafts = await parsePortableMarkdownFiles([markdown, image]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({title: 'Rumors', destination: 'source-note'});
    expect(drafts[0].wikilinks).toEqual(['Mira']);
  });
});
