import type {
  EntityCategory,
  LoreDocumentLink,
  LoreEntityKind,
  LoreEntityProposal,
  WorldEntity
} from '../../entityTypes';
import {saveCharacter} from '../../characterStorage';
import {getCategoriesByProject, saveCategory} from '../../categoryStorage';
import {saveEntity} from '../../entityStorage';
import {replaceLoreDocumentLinks} from '../../loreStorage';

const CATEGORY_CONFIG: Record<
  Exclude<LoreEntityKind, 'character'>,
  {name: string; slug: string; fieldSchema: EntityCategory['fieldSchema']}
> = {
  location: {
    name: 'Locations',
    slug: 'locations',
    fieldSchema: [
      {key: 'description', label: 'Description', type: 'textarea'},
      {key: 'climate', label: 'Climate', type: 'text'},
      {key: 'population', label: 'Population', type: 'text'}
    ]
  },
  item: {
    name: 'Items',
    slug: 'items',
    fieldSchema: [
      {key: 'description', label: 'Description', type: 'textarea'},
      {key: 'rarity', label: 'Rarity', type: 'text'}
    ]
  },
  faction: {
    name: 'Factions',
    slug: 'factions',
    fieldSchema: [
      {key: 'description', label: 'Description', type: 'textarea'},
      {key: 'notes', label: 'Notes', type: 'textarea'}
    ]
  },
  concept: {
    name: 'Concepts',
    slug: 'concepts',
    fieldSchema: [
      {key: 'description', label: 'Description', type: 'textarea'},
      {key: 'notes', label: 'Notes', type: 'textarea'}
    ]
  }
};

async function ensureCategoryForKind(
  projectId: string,
  kind: Exclude<LoreEntityKind, 'character'>
): Promise<EntityCategory> {
  const categories = await getCategoriesByProject(projectId);
  const config = CATEGORY_CONFIG[kind];
  const existing =
    categories.find((category) => category.slug === config.slug) ??
    categories.find((category) => category.name.toLowerCase() === config.name.toLowerCase());
  if (existing) return existing;

  const category: EntityCategory = {
    id: crypto.randomUUID(),
    projectId,
    name: config.name,
    slug: config.slug,
    fieldSchema: config.fieldSchema,
    createdAt: Date.now()
  };
  await saveCategory(category);
  return category;
}

export async function acceptLoreEntityProposal(params: {
  proposal: LoreEntityProposal;
  existingLinks: LoreDocumentLink[];
}): Promise<{targetType: 'character' | 'entity'; targetId: string}> {
  const now = Date.now();
  if (params.proposal.targetType && params.proposal.targetId) {
    const nextLinks = [
      ...params.existingLinks.filter(
        (link) =>
          !(
            link.targetType === params.proposal.targetType &&
            link.targetId === params.proposal.targetId
          )
      ),
      {
        id: crypto.randomUUID(),
        projectId: params.proposal.projectId,
        loreDocumentId: params.proposal.loreDocumentId,
        targetType: params.proposal.targetType,
        targetId: params.proposal.targetId,
        relationship: 'mentions' as const,
        createdAt: now
      }
    ];
    await replaceLoreDocumentLinks({
      loreDocumentId: params.proposal.loreDocumentId,
      links: nextLinks
    });
    return {
      targetType: params.proposal.targetType,
      targetId: params.proposal.targetId
    };
  }

  if (params.proposal.entityKind === 'character') {
    const characterId = crypto.randomUUID();
    await saveCharacter({
      id: characterId,
      projectId: params.proposal.projectId,
      name: params.proposal.name,
      description: '',
      fields: {},
      createdAt: now,
      updatedAt: now
    });
    await replaceLoreDocumentLinks({
      loreDocumentId: params.proposal.loreDocumentId,
      links: [
        ...params.existingLinks,
        {
          id: crypto.randomUUID(),
          projectId: params.proposal.projectId,
          loreDocumentId: params.proposal.loreDocumentId,
          targetType: 'character',
          targetId: characterId,
          relationship: 'primary_subject',
          createdAt: now
        }
      ]
    });
    return {targetType: 'character', targetId: characterId};
  }

  const category = await ensureCategoryForKind(params.proposal.projectId, params.proposal.entityKind);
  const entityId = crypto.randomUUID();
  const entity: WorldEntity = {
    id: entityId,
    projectId: params.proposal.projectId,
    categoryId: category.id,
    name: params.proposal.name,
    fields: {},
    links: [],
    needsCompletion: true,
    createdAt: now,
    updatedAt: now
  };
  await saveEntity(entity);
  await replaceLoreDocumentLinks({
    loreDocumentId: params.proposal.loreDocumentId,
    links: [
      ...params.existingLinks,
      {
        id: crypto.randomUUID(),
        projectId: params.proposal.projectId,
        loreDocumentId: params.proposal.loreDocumentId,
        targetType: 'entity',
        targetId: entityId,
        relationship:
          params.proposal.entityKind === 'location' ? 'primary_subject' : 'mentions',
        createdAt: now
      }
    ]
  });
  return {targetType: 'entity', targetId: entityId};
}
