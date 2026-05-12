import {describe, expect, it} from 'vitest';
import {buildCharacterMergeCandidatesById, mergeCharacterFields} from './characterMergeHelpers';
import type {Character} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency';

const makeCharacter = (id: string, name: string, fields: Character['fields'] = {}): Character => ({
  id,
  projectId: 'project-1',
  name,
  fields,
  createdAt: 1,
  updatedAt: 1
});

describe('characterMergeHelpers', () => {
  it('suggests longer and shorter name variants as merge candidates', () => {
    const candidates = buildCharacterMergeCandidatesById({
      characters: [makeCharacter('kael', 'Kael'), makeCharacter('kaelor', 'Kaelor')],
      aliases: []
    });

    expect(candidates.get('kael')?.[0]?.character.id).toBe('kaelor');
    expect(candidates.get('kael')?.[0]?.reasons).toContain(
      'Looks like a longer or shorter name variant'
    );
  });

  it('suggests fuller multi-token names for strong single-token variants', () => {
    const candidates = buildCharacterMergeCandidatesById({
      characters: [
        makeCharacter('garcia', 'Garcia'),
        makeCharacter('garcia-full', 'Garcia de Terra')
      ],
      aliases: []
    });

    expect(candidates.get('garcia')?.[0]?.character.id).toBe('garcia-full');
    expect(candidates.get('garcia')?.[0]?.reasons).toContain(
      'Looks like a longer or shorter name variant'
    );
  });

  it('treats alias overlap as a stronger merge signal', () => {
    const aliases: ConsistencyAlias[] = [
      {
        id: 'alias-1',
        projectId: 'project-1',
        targetId: 'kaelor',
        targetType: 'character',
        alias: 'Kael',
        createdAt: 1,
        updatedAt: 1
      }
    ];

    const candidates = buildCharacterMergeCandidatesById({
      characters: [makeCharacter('kael', 'Kael'), makeCharacter('kaelor', 'Kaelor')],
      aliases
    });

    expect(candidates.get('kael')?.[0]?.reasons[0]).toBe('Name already exists as an alias');
  });

  it('fills empty target fields without clobbering populated values', () => {
    expect(
      mergeCharacterFields(
        {role: 'Scout', notes: ''},
        {role: 'Mage', notes: 'Carries a blue journal'}
      )
    ).toEqual({
      role: 'Scout',
      notes: 'Carries a blue journal'
    });
  });
});
