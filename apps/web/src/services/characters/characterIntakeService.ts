import type {EntityCategory, EntityFields, WorldEntity} from '../../entityTypes';
import {getCategoriesByProject, saveCategory} from '../../categoryStorage';
import {getEntitiesByProject, saveEntity} from '../../entityStorage';
import {isCharacterCategory, normalizeCharacterIdentityName} from './characterIdentity';

const DEFAULT_CHARACTER_FIELD_SCHEMA: EntityCategory['fieldSchema'] = [
  {key: 'description', label: 'Description', type: 'textarea'},
  {key: 'age', label: 'Age', type: 'text'},
  {key: 'role', label: 'Role', type: 'text'},
  {key: 'notes', label: 'Notes', type: 'textarea'}
];

export interface CharacterCanonIntakePlan {
  category: EntityCategory;
  entity: WorldEntity;
  categoryToCreate: EntityCategory | null;
  entityToCreate: WorldEntity | null;
}

export function planCharacterCanonIntake(params: {
  projectId: string;
  name: string;
  fields?: EntityFields;
  categories: EntityCategory[];
  entities: WorldEntity[];
  preferredEntityId?: string;
  now?: number;
  createId?: () => string;
}): CharacterCanonIntakePlan {
  const name = params.name.trim();
  if (!name) {
    throw new Error('Enter a character name before saving.');
  }
  const characterCategories = params.categories.filter(isCharacterCategory);
  const characterCategoryIds = new Set(characterCategories.map((category) => category.id));

  if (params.preferredEntityId) {
    const preferred = params.entities.find(
      (entity) =>
        entity.id === params.preferredEntityId &&
        characterCategoryIds.has(entity.categoryId)
    );
    if (!preferred) {
      throw new Error('The linked World Bible character could not be found.');
    }
    return {
      category: params.categories.find((category) => category.id === preferred.categoryId)!,
      entity: preferred,
      categoryToCreate: null,
      entityToCreate: null
    };
  }

  const normalizedName = normalizeCharacterIdentityName(name);
  const exactMatches = params.entities.filter(
    (entity) =>
      characterCategoryIds.has(entity.categoryId) &&
      normalizeCharacterIdentityName(entity.name) === normalizedName
  );
  if (exactMatches.length > 1) {
    throw new Error(
      `More than one World Bible character is named "${name}". Resolve that identity before adding Character Tools.`
    );
  }
  if (exactMatches.length === 1) {
    const entity = exactMatches[0];
    return {
      category: params.categories.find((category) => category.id === entity.categoryId)!,
      entity,
      categoryToCreate: null,
      entityToCreate: null
    };
  }

  const now = params.now ?? Date.now();
  const createId = params.createId ?? (() => crypto.randomUUID());
  const category = characterCategories[0] ?? {
    id: createId(),
    projectId: params.projectId,
    kind: 'character' as const,
    name: 'Characters',
    slug: 'characters',
    fieldSchema: DEFAULT_CHARACTER_FIELD_SCHEMA,
    createdAt: now
  };
  const entity: WorldEntity = {
    id: createId(),
    projectId: params.projectId,
    categoryId: category.id,
    name,
    fields: params.fields ?? {},
    isNew: false,
    needsCompletion: false,
    links: [],
    createdAt: now,
    updatedAt: now
  };
  return {
    category,
    entity,
    categoryToCreate: characterCategories.length === 0 ? category : null,
    entityToCreate: entity
  };
}

export async function ensureCanonicalCharacterForIntake(params: {
  projectId: string;
  name: string;
  fields?: EntityFields;
  preferredEntityId?: string;
  categories?: EntityCategory[];
  entities?: WorldEntity[];
}): Promise<CharacterCanonIntakePlan> {
  const [categories, entities] = await Promise.all([
    params.categories ?? getCategoriesByProject(params.projectId),
    params.entities ?? getEntitiesByProject(params.projectId)
  ]);
  const plan = planCharacterCanonIntake({...params, categories, entities});
  if (plan.categoryToCreate) {
    await saveCategory(plan.categoryToCreate);
  }
  if (plan.entityToCreate) {
    await saveEntity(plan.entityToCreate);
  }
  return plan;
}
