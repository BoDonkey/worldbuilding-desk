import {describe, expect, it} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {
  buildWorldBibleAiDraftPrompt,
  getWorldBibleAiDraftableFields,
  parseWorldBibleAiDraft
} from './worldBibleAiDraft';

const makeCategory = (): EntityCategory => ({
  id: 'cat-factions',
  projectId: 'project-1',
  name: 'Factions',
  slug: 'factions',
  createdAt: 1,
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'status', label: 'Status', type: 'select', options: ['Active', 'Dormant']},
    {
      key: 'domains',
      label: 'Domains',
      type: 'multiselect',
      options: ['Trade', 'Espionage', 'Religion']
    },
    {key: 'influence', label: 'Influence', type: 'number'},
    {key: 'public', label: 'Public', type: 'checkbox'}
  ]
});

describe('worldBibleAiDraft', () => {
  it('parses schema-mapped AI fields without accepting unknown keys', () => {
    const draft = parseWorldBibleAiDraft(
      [
        '```json',
        JSON.stringify({
          name: 'Glass Council',
          fields: {
            description: 'A trade syndicate with ritual obligations.',
            status: 'active',
            domains: ['Trade', 'Espionage', 'Unknown'],
            influence: 7,
            invented: 'ignore me'
          }
        }),
        '```'
      ].join('\n'),
      makeCategory()
    );

    expect(draft).toEqual({
      name: 'Glass Council',
      fields: {
        description: '<p>A trade syndicate with ritual obligations.</p>',
        status: 'Active',
        domains: 'Trade, Espionage',
        influence: '7'
      }
    });
  });

  it('excludes checkbox fields from draft prompts', () => {
    expect(getWorldBibleAiDraftableFields(makeCategory()).map((field) => field.key)).toEqual([
      'description',
      'status',
      'domains',
      'influence'
    ]);
  });

  it('builds a schema-aware prompt with category fields and options', () => {
    const prompt = buildWorldBibleAiDraftPrompt(makeCategory(), 'A covert guild.');

    expect(prompt).toContain('Create a World Bible draft for the category "Factions"');
    expect(prompt).toContain('- status: Status (select). Options: Active, Dormant.');
    expect(prompt).toContain('Do not invent categories or save canon automatically.');
  });
});
