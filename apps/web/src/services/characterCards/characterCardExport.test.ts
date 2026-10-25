import {describe, expect, it} from 'vitest';
import type {CanonicalFact, EntityCategory, WorldEntity} from '../../entityTypes';
import {buildCharacterCardV2, characterCardFileName, richTextToCardText} from './characterCardExport';
import {parseCharacterCard} from './characterCardParse';

const category: EntityCategory = {
  id: 'characters',
  projectId: 'p1',
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'age', label: 'Age', type: 'text'},
    {key: 'role', label: 'Role', type: 'text'},
    {key: 'notes', label: 'Notes', type: 'textarea'}
  ],
  createdAt: 1
};

const entity: WorldEntity = {
  id: 'mira',
  projectId: 'p1',
  categoryId: 'characters',
  name: 'Mira Voss',
  fields: {
    description: '<p>A smith in <strong>Glass Harbor</strong>.</p><p>Left-handed.</p>',
    age: '34',
    role: '',
    homeport: 'Salt Point',
    notes: '<p>Maybe she knew the envoy.</p>'
  },
  links: [],
  createdAt: 1,
  updatedAt: 1
};

const fact = (factType: CanonicalFact['factType'], value: CanonicalFact['value']): CanonicalFact => ({
  id: `${factType}-${JSON.stringify(value)}`,
  projectId: 'p1',
  targetType: 'entity',
  targetId: 'mira',
  factType,
  value,
  acceptedAt: 1,
  updatedAt: 1
});

const build = (overrides: Partial<Parameters<typeof buildCharacterCardV2>[0]> = {}) =>
  buildCharacterCardV2({
    entity,
    category,
    aliases: ['Lantern-Mira', 'mira voss', ' Lantern-Mira '],
    facts: [
      fact('trait', 'blunt'),
      fact('trait', 'patient'),
      fact('trait', 'blunt'),
      fact('occupation', 'smith'),
      fact('relationship', {label: 'sister', value: 'Dess'}),
      fact('alias', 'Lantern-Mira')
    ],
    exportedAt: new Date(2026, 9, 24, 23, 30).getTime(),
    ...overrides
  });

describe('buildCharacterCardV2', () => {
  it('writes the record, aliases, and accepted facts in the V2 shape', () => {
    const card = build();
    expect(card.spec).toBe('chara_card_v2');
    expect(card.spec_version).toBe('2.0');
    expect(card.data.name).toBe('Mira Voss');
    expect(card.data.description).toBe(
      [
        'A smith in Glass Harbor.\n\nLeft-handed.',
        'Age: 34\nhomeport: Salt Point',
        'Also known as: Lantern-Mira',
        'Facts:\n- occupation: smith\n- relationship: sister: Dess'
      ].join('\n\n')
    );
    expect(card.data.personality).toBe('blunt; patient');
    expect(card.data.creator_notes).toBe('Exported from SagaSpine on 2026-10-24.\n\nAuthor notes:\nMaybe she knew the envoy.');
    expect(card.data).toMatchObject({
      scenario: '',
      first_mes: '',
      mes_example: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      extensions: {}
    });
  });

  it('leaves out what the character does not have', () => {
    const card = build({
      entity: {...entity, fields: {description: ''}},
      category: null,
      aliases: [],
      facts: []
    });
    expect(card.data.description).toBe('');
    expect(card.data.personality).toBe('');
    expect(card.data.creator_notes).toBe('Exported from SagaSpine on 2026-10-24.');
  });

  it('reads back through the card importer', () => {
    const card = parseCharacterCard(JSON.parse(JSON.stringify(build())));
    expect(card).toMatchObject({spec: 'v2', name: 'Mira Voss', personality: 'blunt; patient'});
    expect(card.description).toContain('Also known as: Lantern-Mira');
  });
});

describe('richTextToCardText', () => {
  it('keeps paragraphs, breaks, and list items, and decodes entities', () => {
    expect(richTextToCardText('<p>One &amp; two</p><p>Three<br>four</p><ul><li>a</li><li>b &lt;c&gt;</li></ul>')).toBe(
      'One & two\n\nThree\nfour\n\n- a\n\n- b <c>'
    );
    expect(richTextToCardText('  plain text  ')).toBe('plain text');
  });
});

describe('characterCardFileName', () => {
  it('makes a safe file name from the character name', () => {
    expect(characterCardFileName('Mira Voss')).toBe('Mira_Voss.card.json');
    expect(characterCardFileName('../../etc/pass:wd')).toBe('....etcpasswd.card.json');
    expect(characterCardFileName('  ')).toBe('character.card.json');
    expect(characterCardFileName('Ségolène 剣')).toBe('Ségolène_剣.card.json');
  });
});
