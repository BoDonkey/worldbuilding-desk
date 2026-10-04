import type {
  Character,
  EntityCategory,
  EntityFields,
  LoreDocumentLink,
  LoreEntityKind,
  LoreEntityProposal,
  WorldEntity
} from '../../entityTypes';
import {
  CATEGORY_STORE_NAME,
  CHARACTER_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME
} from '../../db';
import {getCharactersByProject, putCharacterInTransaction} from '../../characterStorage';
import {getCategoriesByProject, putCategoryInTransaction} from '../../categoryStorage';
import {getEntitiesByProject, putEntityInTransaction} from '../../entityStorage';
import {replaceLoreDocumentLinksInTransaction} from '../../loreStorage';
import {planCharacterCanonIntake} from '../characters/characterIntakeService';
import {getAliasesByProject, planAliasSave, putAliasInTransaction} from '../consistency/aliasStorage';
import {runProjectWriteTransaction} from '../storage/projectWriteTransaction';
import {putLoreEntityProposalInTransaction} from './loreEntityProposalStorage';

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

/** The category an accepted entity of this kind belongs in: an existing match, or a new one. */
function planCategoryForKind(
  projectId: string,
  kind: Exclude<LoreEntityKind, 'character'>,
  categories: EntityCategory[]
): {category: EntityCategory; create: boolean} {
  const config = CATEGORY_CONFIG[kind];
  const existing =
    categories.find((category) => category.slug === config.slug) ??
    categories.find((category) => category.name.toLowerCase() === config.name.toLowerCase());
  if (existing) return {category: existing, create: false};
  return {
    create: true,
    category: {
      id: crypto.randomUUID(),
      projectId,
      kind: 'general',
      name: config.name,
      slug: config.slug,
      fieldSchema: config.fieldSchema,
      createdAt: Date.now()
    }
  };
}

interface AcceptedEntityTarget {
  targetType: 'character' | 'entity';
  targetId: string;
}

/**
 * Accepts an entity proposal as canon. Everything it changes — a new
 * category, entity, or canonical character link, the Source Note links, an
 * optional alias, and the proposal's own accepted status — commits in one
 * transaction, so a failure part-way leaves no partial canon behind.
 *
 * `acceptedProposal` is the proposal record to store (default: the proposal
 * marked accepted with the resolved target). `alias` records an alias for the
 * resolved canon in the same commit. Derived indexes are the caller's job,
 * after this resolves.
 */
export async function acceptLoreEntityProposal(params: {
  proposal: LoreEntityProposal;
  existingLinks: LoreDocumentLink[];
  alias?: {targetType: 'character' | 'entity'; targetId: string; alias: string};
  acceptedProposal?: (target: AcceptedEntityTarget) => LoreEntityProposal;
}): Promise<AcceptedEntityTarget> {
  const {proposal} = params;
  const projectId = proposal.projectId;
  const now = Date.now();

  // Read.
  const [categories, entities, characters, aliases] = await Promise.all([
    getCategoriesByProject(projectId),
    getEntitiesByProject(projectId),
    proposal.targetType === 'character' && proposal.targetId
      ? getCharactersByProject(projectId)
      : Promise.resolve([] as Character[]),
    params.alias ? getAliasesByProject(projectId) : Promise.resolve([])
  ]);

  // Plan.
  const categoriesToPut: EntityCategory[] = [];
  const entitiesToPut: WorldEntity[] = [];
  const charactersToPut: Character[] = [];
  let target: AcceptedEntityTarget;
  let newLink: Pick<LoreDocumentLink, 'targetType' | 'targetId' | 'relationship'>;
  let keepOtherTargetsOnly = false;

  const planCanon = (name: string, fields: EntityFields, preferredEntityId?: string) => {
    const plan = planCharacterCanonIntake({projectId, name, fields, preferredEntityId, categories, entities});
    if (plan.categoryToCreate) categoriesToPut.push(plan.categoryToCreate);
    if (plan.entityToCreate) entitiesToPut.push(plan.entityToCreate);
    return plan.entity;
  };

  if (proposal.targetType && proposal.targetId) {
    target = {targetType: proposal.targetType, targetId: proposal.targetId};
    if (target.targetType === 'character') {
      const character = characters.find((record) => record.id === target.targetId);
      if (!character) {
        throw new Error('The selected legacy character record could not be found.');
      }
      const canon = planCanon(
        character.name,
        {...(character.description ? {description: character.description} : {}), ...character.fields},
        character.entityId
      );
      charactersToPut.push({...character, entityId: canon.id, updatedAt: now});
      target = {targetType: 'entity', targetId: canon.id};
    }
    newLink = {...target, relationship: 'mentions'};
    keepOtherTargetsOnly = true;
  } else if (proposal.entityKind === 'character') {
    const canon = planCanon(proposal.name, {});
    target = {targetType: 'entity', targetId: canon.id};
    newLink = {...target, relationship: 'primary_subject'};
  } else {
    const {category, create} = planCategoryForKind(projectId, proposal.entityKind, categories);
    if (create) categoriesToPut.push(category);
    const entity: WorldEntity = {
      id: crypto.randomUUID(),
      projectId,
      categoryId: category.id,
      name: proposal.name,
      fields: {},
      links: [],
      needsCompletion: true,
      createdAt: now,
      updatedAt: now
    };
    entitiesToPut.push(entity);
    target = {targetType: 'entity', targetId: entity.id};
    newLink = {...target, relationship: proposal.entityKind === 'location' ? 'primary_subject' : 'mentions'};
  }

  const links: LoreDocumentLink[] = [
    ...(keepOtherTargetsOnly
      ? params.existingLinks.filter(
          (link) => !(link.targetType === target.targetType && link.targetId === target.targetId)
        )
      : params.existingLinks),
    {
      id: crypto.randomUUID(),
      projectId,
      loreDocumentId: proposal.loreDocumentId,
      ...newLink,
      createdAt: now
    }
  ];
  const aliasRecord = params.alias ? planAliasSave(aliases, {projectId, ...params.alias}, now) : null;
  const proposalRecord =
    params.acceptedProposal?.(target) ??
    {...proposal, status: 'accepted', targetType: target.targetType, targetId: target.targetId, updatedAt: now};

  // Commit.
  await runProjectWriteTransaction(
    [
      CATEGORY_STORE_NAME,
      ENTITY_STORE_NAME,
      CHARACTER_STORE_NAME,
      LORE_DOCUMENT_LINK_STORE_NAME,
      LORE_ENTITY_PROPOSAL_STORE_NAME,
      ...(aliasRecord ? [CONSISTENCY_ALIAS_STORE_NAME] : [])
    ],
    async (tx) => {
      for (const category of categoriesToPut) await putCategoryInTransaction(tx, category);
      for (const entity of entitiesToPut) await putEntityInTransaction(tx, entity);
      for (const character of charactersToPut) await putCharacterInTransaction(tx, character);
      await replaceLoreDocumentLinksInTransaction(tx, {loreDocumentId: proposal.loreDocumentId, links});
      if (aliasRecord) await putAliasInTransaction(tx, aliasRecord);
      await putLoreEntityProposalInTransaction(tx, proposalRecord);
    }
  );
  return target;
}
