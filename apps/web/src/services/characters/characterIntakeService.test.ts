import {describe, expect, it} from 'vitest';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  WorldEntity
} from '../../entityTypes';
import {validateCharacterWrite} from '../../characterStorage';
import {validateCharacterSheetWrite} from './characterSheetService';
import {planCharacterCanonIntake} from './characterIntakeService';

const category = (
  id: string,
  kind: EntityCategory['kind'] = 'character'
): EntityCategory => ({
  id,
  projectId: 'project-1',
  kind,
  name: kind === 'character' ? 'Characters' : 'People Notes',
  slug: kind === 'character' ? 'characters' : 'people-notes',
  fieldSchema: [],
  createdAt: 1
});

const entity = (id: string, categoryId: string, name: string): WorldEntity => ({
  id,
  projectId: 'project-1',
  categoryId,
  name,
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1
});

const character = (entityId?: string): Character => ({
  id: 'character-mira',
  projectId: 'project-1',
  entityId,
  name: 'Mira Voss',
  fields: {},
  createdAt: 1,
  updatedAt: 1
});

const sheet = (characterEntityId?: string): CharacterSheet => ({
  id: 'sheet-mira',
  projectId: 'project-1',
  characterEntityId,
  name: 'Mira Voss',
  level: 1,
  experience: 0,
  stats: [],
  resources: [],
  inventory: [],
  createdAt: 1,
  updatedAt: 1
});

describe('character intake convergence', () => {
  it('plans a canonical category and entity when a project has neither', () => {
    const ids = ['category-new', 'entity-new'];
    const plan = planCharacterCanonIntake({
      projectId: 'project-1',
      name: '  Mira Voss  ',
      fields: {role: 'Cartographer'},
      categories: [],
      entities: [],
      now: 10,
      createId: () => ids.shift()!
    });

    expect(plan.categoryToCreate).toMatchObject({
      id: 'category-new',
      kind: 'character'
    });
    expect(plan.entityToCreate).toMatchObject({
      id: 'entity-new',
      categoryId: 'category-new',
      name: 'Mira Voss',
      fields: {role: 'Cartographer'}
    });
  });

  it('links the sole exact character-kind match without inventing canon', () => {
    const characters = category('characters');
    const mira = entity('entity-mira', characters.id, 'Mira Voss');
    const plan = planCharacterCanonIntake({
      projectId: 'project-1',
      name: '  MIRA   VOSS ',
      categories: [characters],
      entities: [mira]
    });

    expect(plan.entity).toBe(mira);
    expect(plan.categoryToCreate).toBeNull();
    expect(plan.entityToCreate).toBeNull();
  });

  it('does not treat a same-name general record as character canon', () => {
    const general = category('general-people', 'general');
    const plan = planCharacterCanonIntake({
      projectId: 'project-1',
      name: 'Mira Voss',
      categories: [general],
      entities: [entity('general-mira', general.id, 'Mira Voss')],
      now: 10,
      createId: (() => {
        const ids = ['category-new', 'entity-new'];
        return () => ids.shift()!;
      })()
    });

    expect(plan.category.kind).toBe('character');
    expect(plan.entity.id).toBe('entity-new');
  });

  it('refuses ambiguous canon and guards new unlinked extension or sheet writes', () => {
    const characters = category('characters');
    expect(() =>
      planCharacterCanonIntake({
        projectId: 'project-1',
        name: 'Mira Voss',
        categories: [characters],
        entities: [
          entity('entity-mira-1', characters.id, 'Mira Voss'),
          entity('entity-mira-2', characters.id, ' mira  voss ')
        ]
      })
    ).toThrow('More than one World Bible character');
    expect(() => validateCharacterWrite(character())).toThrow(
      'require a canonical World Bible character link'
    );
    expect(() => validateCharacterSheetWrite(sheet())).toThrow(
      'require a canonical World Bible character link'
    );
    expect(() => validateCharacterWrite(character('entity-mira'))).not.toThrow();
    expect(() => validateCharacterSheetWrite(sheet('entity-mira'))).not.toThrow();
  });

  it('allows legacy updates but never removes an established canonical link', () => {
    expect(() => validateCharacterWrite(character(), character())).not.toThrow();
    expect(() => validateCharacterSheetWrite(sheet(), sheet())).not.toThrow();
    expect(() =>
      validateCharacterWrite(character(), character('entity-mira'))
    ).toThrow('cannot be removed');
    expect(() =>
      validateCharacterSheetWrite(sheet(), sheet('entity-mira'))
    ).toThrow('cannot be removed');
  });
});
