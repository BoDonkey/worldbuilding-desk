import {describe, expect, it} from 'vitest';
import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {
  buildCharacterFromDescriptionRecords,
  CHARACTER_PROFILE_AUTO_FACT_CONFIDENCE,
  CHARACTER_PROFILE_FACT_CONFIDENCE,
  CHARACTER_PROFILE_UNSURE_FACT_CONFIDENCE,
  CharacterProfileReplyError,
  extractDeterministicProfileFacts,
  findCharacterNameCollisions,
  findQuoteSpan,
  parseCharacterProfileReply,
  SUGGESTED_DETAILS_HEADING
} from './characterFromDescription';

const description =
  'Mara Voss is a ferry pilot on the Grey River.\nShe is stubborn, keeps  her  debts, and hates bells.';

const reply = (value: unknown) => JSON.stringify(value);

describe('findQuoteSpan', () => {
  it('finds a quote ignoring case and whitespace runs and returns the description text', () => {
    expect(findQuoteSpan(description, 'keeps her debts')).toEqual({
      start: description.indexOf('keeps'),
      end: description.indexOf('debts') + 'debts'.length,
      text: 'keeps  her  debts'
    });
    expect(findQuoteSpan(description, 'FERRY PILOT')?.text).toBe('ferry pilot');
    expect(findQuoteSpan(description, 'loves bells')).toBeNull();
    expect(findQuoteSpan(description, '  ')).toBeNull();
  });
});

describe('extractDeterministicProfileFacts', () => {
  it('reads a stated age and slash-form pronouns with their exact spans', () => {
    const text = 'Odile, 42 years old, a lock-keeper. Pronouns: she/they.';
    const facts = extractDeterministicProfileFacts(text);
    expect(facts.map(({factType, value, source}) => ({factType, value, source}))).toEqual([
      {factType: 'age', value: '42', source: 'auto'},
      {factType: 'identity', value: 'she/they', source: 'auto'}
    ]);
    expect(text.slice(facts[0].evidence.start, facts[0].evidence.end)).toBe('42 years old');
    expect(facts[1].evidence.text).toBe('Pronouns: she/they');
  });

  it('accepts other common age forms', () => {
    expect(extractDeterministicProfileFacts('Aged 70, still rowing.')[0]?.value).toBe('70');
    expect(extractDeterministicProfileFacts('Age: 9')[0]?.value).toBe('9');
    expect(extractDeterministicProfileFacts('a 30-year-old smith')[0]?.value).toBe('30');
  });

  it('does not read generic or unrelated text as a fact', () => {
    expect(extractDeterministicProfileFacts('Turn to page 4 at the stage door; he/she will know.')).toEqual([]);
    expect(extractDeterministicProfileFacts('Four years older than her brother.')).toEqual([]);
  });
});

describe('parseCharacterProfileReply', () => {
  it('keeps quoted facts with description spans and drops untraceable ones', () => {
    const profile = parseCharacterProfileReply(
      '```json\n' +
        reply({
          name: 'Mara Voss',
          stableFacts: [
            {factType: 'occupation', value: 'ferry pilot', quote: 'a ferry pilot on the Grey River'},
            {factType: 'trait', value: 'stubborn', quote: 'She is stubborn'},
            {factType: 'trait', value: 'Stubborn', quote: 'stubborn'},
            {factType: 'background', value: 'orphaned young', quote: 'lost her parents'},
            {factType: 'goal', value: '  ', quote: 'hates bells'}
          ],
          suggestedDetails: ['A brother who drowned', ' A brother who drowned ', 'Hums while steering', '']
        }) +
        '\n```',
      description
    );

    expect(profile.name).toBe('Mara Voss');
    expect(profile.droppedName).toBe(false);
    expect(profile.stableFacts).toEqual([
      {
        factType: 'occupation',
        value: 'ferry pilot',
        evidence: {
          start: description.indexOf('a ferry'),
          end: description.indexOf('River') + 'River'.length,
          text: 'a ferry pilot on the Grey River'
        },
        source: 'model'
      },
      {
        factType: 'trait',
        value: 'stubborn',
        evidence: {start: description.indexOf('She'), end: description.indexOf('stubborn') + 8, text: 'She is stubborn'},
        source: 'model'
      }
    ]);
    expect(profile.droppedFactCount).toBe(2);
    expect(profile.suggestedDetails).toEqual(['A brother who drowned', 'Hums while steering']);
  });

  it('accepts identity facts and maps gender and pronoun near-misses to identity', () => {
    const profile = parseCharacterProfileReply(
      reply({
        name: null,
        stableFacts: [
          {factType: 'identity', value: 'she/her', quote: 'She is stubborn'},
          {factType: 'Gender', value: 'woman', quote: 'She is stubborn'},
          {factType: 'pronouns', value: 'she', quote: 'She'}
        ],
        suggestedDetails: []
      }),
      description
    );

    expect(profile.stableFacts.map((fact) => fact.factType)).toEqual(['identity', 'identity', 'identity']);
  });

  it('puts code-read facts first, lets them replace a model age, and keeps the unsure flag', () => {
    const text = 'Odile is 42 years old (she/her). She mends locks.';
    const profile = parseCharacterProfileReply(
      reply({
        name: 'Odile',
        stableFacts: [
          {factType: 'age', value: '24', quote: '42 years old'},
          {factType: 'identity', value: 'she/her', quote: 'she/her'},
          {factType: 'occupation', value: 'locksmith', quote: 'She mends locks', typeUnsure: true}
        ],
        suggestedDetails: []
      }),
      text
    );

    expect(profile.stableFacts.map(({factType, value, source, typeUnsure}) => ({factType, value, source, typeUnsure}))).toEqual([
      {factType: 'age', value: '42', source: 'auto', typeUnsure: undefined},
      {factType: 'identity', value: 'she/her', source: 'auto', typeUnsure: undefined},
      {factType: 'occupation', value: 'locksmith', source: 'model', typeUnsure: true}
    ]);
  });

  it('stores code-read, model, and type-unsure facts at different review confidences', () => {
    const evidence = {start: 0, end: 4, text: 'Mara'};
    let next = 0;
    const records = buildCharacterFromDescriptionRecords({
      projectId: 'p',
      sessionId: 's',
      description,
      target: {kind: 'new', categoryId: 'characters', name: 'Mara Voss'},
      stableFacts: [
        {factType: 'age', value: '40', evidence, source: 'auto'},
        {factType: 'trait', value: 'stubborn', evidence, source: 'model'},
        {factType: 'occupation', value: 'pilot', evidence, source: 'model', typeUnsure: true}
      ],
      suggestedDetails: [],
      now: 1,
      createId: () => `id-${next++}`
    });

    expect(records.proposals.map((proposal) => proposal.confidence)).toEqual([
      CHARACTER_PROFILE_AUTO_FACT_CONFIDENCE,
      CHARACTER_PROFILE_FACT_CONFIDENCE,
      CHARACTER_PROFILE_UNSURE_FACT_CONFIDENCE
    ]);
  });

  it('refuses a name the description does not contain', () => {
    const profile = parseCharacterProfileReply(
      reply({name: 'Mara Vossberg', stableFacts: [], suggestedDetails: []}),
      description
    );
    expect(profile.name).toBeNull();
    expect(profile.droppedName).toBe(true);

    const unnamed = parseCharacterProfileReply(
      reply({name: null, stableFacts: [], suggestedDetails: []}),
      'A ferry pilot who hates bells.'
    );
    expect(unnamed).toMatchObject({name: null, droppedName: false});
  });

  it('rejects malformed or out-of-contract replies whole', () => {
    expect(() => parseCharacterProfileReply('Here is a profile!', description)).toThrow(CharacterProfileReplyError);
    expect(() =>
      parseCharacterProfileReply(reply({stableFacts: [{factType: 'hair', value: 'red', quote: 'x'}], suggestedDetails: []}), description)
    ).toThrow(CharacterProfileReplyError);
    expect(() => parseCharacterProfileReply(reply({name: 'Mara'}), description)).toThrow(CharacterProfileReplyError);
  });
});

describe('findCharacterNameCollisions', () => {
  const categories: EntityCategory[] = [
    {id: 'characters', projectId: 'p', kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1},
    {id: 'places', projectId: 'p', kind: 'general', name: 'Places', slug: 'places', fieldSchema: [], createdAt: 1}
  ];
  const entity = (id: string, name: string, categoryId = 'characters'): WorldEntity => ({
    id, projectId: 'p', categoryId, name, fields: {}, links: [], createdAt: 1, updatedAt: 1
  });
  const entities = [entity('e-mara', 'Mara  Voss'), entity('e-oren', 'Oren'), entity('e-voss', 'Voss', 'places')];
  const characters: Character[] = [
    {id: 'c-oren', projectId: 'p', entityId: 'e-oren', name: 'Oren', fields: {}, createdAt: 1, updatedAt: 1}
  ];
  const aliases: ConsistencyAlias[] = [
    {id: 'a1', projectId: 'p', targetId: 'c-oren', targetType: 'character', alias: 'The Pilot', createdAt: 1, updatedAt: 1},
    {id: 'a2', projectId: 'p', targetId: 'e-voss', targetType: 'entity', alias: 'The Pilot', createdAt: 1, updatedAt: 1}
  ];
  const find = (name: string) =>
    findCharacterNameCollisions({name, categories, entities, characters, sheets: [], aliases});

  it('matches canonical names and aliases of character records only, never merging', () => {
    expect(find(' mara voss ')).toEqual([{entityId: 'e-mara', name: 'Mara  Voss', via: 'name', matchedText: 'Mara  Voss'}]);
    expect(find('the pilot')).toEqual([{entityId: 'e-oren', name: 'Oren', via: 'alias', matchedText: 'The Pilot'}]);
    expect(find('Voss')).toEqual([]);
    expect(find('')).toEqual([]);
  });
});

describe('buildCharacterFromDescriptionRecords', () => {
  let counter = 0;
  const createId = () => `id-${++counter}`;
  const profile = parseCharacterProfileReply(
    reply({
      name: 'Mara Voss',
      stableFacts: [{factType: 'trait', value: 'stubborn', quote: 'She is stubborn'}],
      suggestedDetails: ['Hums while steering']
    }),
    description
  );

  it('creates a draft character, a linked Source Note, and proposed facts whose evidence points into the note', () => {
    counter = 0;
    const records = buildCharacterFromDescriptionRecords({
      projectId: 'p',
      sessionId: 's',
      description,
      target: {kind: 'new', categoryId: 'characters', name: ' Mara Voss '},
      stableFacts: profile.stableFacts,
      suggestedDetails: profile.suggestedDetails,
      now: 5,
      createId
    });

    expect(records.entity).toMatchObject({
      id: 'id-1', categoryId: 'characters', name: 'Mara Voss', fields: {}, isNew: true, needsCompletion: true
    });
    expect(records.note).toMatchObject({
      id: 'id-2',
      title: 'Character lab: Mara Voss',
      kind: 'character_dossier',
      source: {type: 'ai-session', sessionId: 's'},
      content: `${description}\n\n${SUGGESTED_DETAILS_HEADING}\n- Hums while steering`
    });
    expect(records.link).toMatchObject({loreDocumentId: 'id-2', targetType: 'entity', targetId: 'id-1', relationship: 'primary_subject'});
    expect(records.proposals).toHaveLength(1);
    const [proposal] = records.proposals;
    expect(proposal).toMatchObject({loreDocumentId: 'id-2', targetId: 'id-1', status: 'proposed', factType: 'trait', value: 'stubborn'});
    expect(records.note.content.slice(proposal.evidence.start, proposal.evidence.end)).toBe('She is stubborn');
  });

  it('adds to an existing character without creating another record', () => {
    const records = buildCharacterFromDescriptionRecords({
      projectId: 'p',
      sessionId: 's',
      description,
      target: {kind: 'existing', entityId: 'e-mara', name: 'Mara Voss'},
      stableFacts: profile.stableFacts,
      suggestedDetails: [],
      createId
    });

    expect(records.entity).toBeNull();
    expect(records.note.content).toBe(description);
    expect(records.link.targetId).toBe('e-mara');
    expect(records.proposals[0]).toMatchObject({targetId: 'e-mara', status: 'proposed'});
  });

  it('refuses to build without a name or with evidence that no longer matches', () => {
    const base = {projectId: 'p', sessionId: 's', description, stableFacts: profile.stableFacts, suggestedDetails: []};
    expect(() =>
      buildCharacterFromDescriptionRecords({...base, target: {kind: 'new', categoryId: 'characters', name: ' '}})
    ).toThrow('name');
    expect(() =>
      buildCharacterFromDescriptionRecords({
        ...base,
        description: `Edited. ${description}`,
        target: {kind: 'new', categoryId: 'characters', name: 'Mara Voss'}
      })
    ).toThrow('no longer matches');
  });
});
