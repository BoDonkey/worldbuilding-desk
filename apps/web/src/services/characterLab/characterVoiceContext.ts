import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  CharacterStyle,
  CompendiumEntry,
  EntityCategory,
  LoreFactProposal,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {sortWritingDocuments, deriveCharacterSheetNames, type ConsistencyAlias} from '../storage';
import {
  createCharacterLinkResolver,
  type ActorResolution
} from '../characters/characterIdentity';
import type {CharacterRuntimeModifiers} from '../compendium';
import {
  formatCanonicalFactValidity,
  isCanonicalFactValidAtScene
} from '../lore/canonicalFactValidity';
import {
  buildCharacterSnapshot,
  getSceneOrder,
  type CharacterSnapshot,
  type CharacterSnapshotMoment
} from '../state/characterSnapshot';
import {buildWorldBibleEntityContent} from '../worldBible/worldBibleEntityHelpers';

/**
 * Where in the manuscript the character is grounded. Scenes are addressed by
 * stable id and resolved against the manuscript's current order at build time.
 */
export type CharacterVoicePosition =
  | {kind: 'latest'}
  | {
      kind: 'scene';
      sceneId: string;
      moment: CharacterSnapshotMoment;
      cursorPosition?: number;
    };

export type CharacterVoiceSectionKind =
  | 'canon-record'
  | 'accepted-facts'
  | 'dialogue-style'
  | 'story-state'
  /** Another World Bible record one hop from the character (4.71), only when asked for. */
  | 'linked-record';

export interface CharacterVoiceProvenance {
  type: 'world-entity' | 'alias' | 'canonical-fact' | 'character-style' | 'character-sheet';
  id: string;
}

/** One tagged block of grounding, labelled the way it will be shown to the model. */
export interface CharacterVoiceSection {
  kind: CharacterVoiceSectionKind;
  source: string;
  content: string;
  provenance: CharacterVoiceProvenance[];
  /** One entry per accepted fact, so the context budget can leave out single facts. */
  items?: {text: string; provenance: CharacterVoiceProvenance; rank?: number}[];
}

/** Read-only grounding for one character at one manuscript position. */
export interface CharacterVoiceContext {
  entityId: string;
  name: string;
  position: CharacterVoicePosition;
  /** Author-facing description of the position, e.g. `the opening of "The Vault"`. */
  positionLabel: string;
  sections: CharacterVoiceSection[];
  /** The same snapshot the story-state section was written from; null without a sheet. */
  snapshot: CharacterSnapshot | null;
}

export interface CharacterVoiceStateInputs {
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  compendiumEntries: CompendiumEntry[];
}

export const STORY_STATE_KNOWLEDGE_NOTE =
  'This is what is true in the story at this point, not a record of what the character knows.';

/**
 * Which accepted facts the context budget keeps first when not all fit
 * (4.71): who the character is and how they connect to others before
 * history, looks, and habits.
 */
export const FACT_TYPE_RANK: Record<CanonicalFact['factType'], number> = {
  identity: 10,
  age: 9,
  occupation: 8,
  membership: 8,
  relationship: 8,
  heritage: 7,
  goal: 7,
  ability: 6,
  appearance: 5,
  background: 4,
  trait: 3,
  alias: 2
};

export const NO_ACCEPTED_FACTS = 'No accepted facts are recorded for this character at this point.';

/** At most this many linked records are offered to the budget per character. */
export const MAX_LINKED_RECORDS = 8;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Records one hop from the character: those in its `links`, then those an
 * accepted fact of the character names exactly (by name or alias, as a whole
 * phrase). Never the character itself, never two hops, never inferred.
 */
export function findLinkedRecords(params: {
  entity: WorldEntity;
  facts: CanonicalFact[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
}): WorldEntity[] {
  const {entity} = params;
  const byId = new Map(params.entities.map((record) => [record.id, record]));
  const found: WorldEntity[] = [];
  const add = (record: WorldEntity | undefined) => {
    if (record && record.id !== entity.id && record.projectId === entity.projectId && !found.includes(record)) {
      found.push(record);
    }
  };
  (entity.links ?? []).forEach((id) => add(byId.get(id)));

  const factText = params.facts
    .filter((fact) => fact.factType !== 'alias')
    .map(factValueText)
    .join('\n');
  if (factText) {
    const namesById = new Map<string, string[]>();
    params.entities.forEach((record) => namesById.set(record.id, [record.name]));
    params.aliases.forEach((alias) => {
      if ((alias.targetType ?? 'entity') === 'entity') namesById.get(alias.targetId)?.push(alias.alias);
    });
    params.entities.forEach((record) => {
      const names = (namesById.get(record.id) ?? []).map((name) => name.trim()).filter((name) => name.length >= 3);
      if (names.some((name) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(factText))) {
        add(record);
      }
    });
  }
  return found.slice(0, MAX_LINKED_RECORDS);
}

const factValueText = (fact: CanonicalFact): string =>
  typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`;

const describePosition = (
  position: CharacterVoicePosition,
  documents: WritingDocument[]
): string => {
  if (position.kind === 'latest') return 'the latest point in the manuscript';
  const title = documents.find((document) => document.id === position.sceneId)?.title || 'Untitled scene';
  switch (position.moment) {
    case 'opening':
      return `the opening of "${title}"`;
    case 'cursor':
      return `the cursor in "${title}"`;
    case 'ending':
      return `the end of "${title}"`;
  }
};

/**
 * A fact accepted into canon is excluded when its source proposal is known and
 * not accepted: accepting writes the fact before the proposal, so a failed
 * second write must not let a pending or rejected claim ground a character.
 */
export const isAcceptedFact = (
  fact: CanonicalFact,
  proposalStatusById: Map<string, LoreFactProposal['status']>
): boolean => {
  if (!fact.sourceProposalId) return true;
  const status = proposalStatusById.get(fact.sourceProposalId);
  return status === undefined || status === 'accepted';
};

const isFactValidAtPosition = (
  fact: CanonicalFact,
  position: CharacterVoicePosition,
  orderedDocuments: WritingDocument[]
): boolean => {
  const sceneId =
    position.kind === 'scene' ? position.sceneId : orderedDocuments[orderedDocuments.length - 1]?.id;
  if (!sceneId) return !fact.validFromSceneId && !fact.validUntilSceneId;
  return isCanonicalFactValidAtScene(fact, sceneId, orderedDocuments);
};

const formatSnapshot = (snapshot: CharacterSnapshot): string => {
  const lines = [`Level: ${snapshot.level}`];
  snapshot.resources.forEach((resource) => {
    lines.push(
      `${resource.label}: ${resource.current}${resource.max === undefined ? '' : `/${resource.max}`}`
    );
  });
  snapshot.stats.forEach((stat) => lines.push(`${stat.label}: ${stat.value}`));
  if (snapshot.statuses.length > 0) lines.push(`Statuses: ${snapshot.statuses.join('; ')}`);
  if (snapshot.inventory.length > 0) {
    lines.push(
      `Carrying: ${snapshot.inventory
        .map(
          (item) =>
            `${item.name}${item.quantity === 1 ? '' : ` x${item.quantity}`}${item.equipped ? ' (equipped)' : ''}`
        )
        .join(', ')}`
    );
  }
  if (snapshot.location) lines.push(`Location: ${snapshot.location}`);
  return lines.join('\n');
};

/**
 * Assemble the grounding a character-lab run may use for one character:
 * the canonical World Bible record and aliases, accepted canon facts valid at
 * the position, the assigned dialogue style, and replayed story state. Reads
 * only; identity goes through the shared character link resolver.
 */
export function buildCharacterVoiceContext(params: {
  entityId: string;
  position: CharacterVoicePosition;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  actorResolutions?: ActorResolution[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  /** Used only to exclude facts whose source proposal is not accepted. */
  factProposals?: LoreFactProposal[];
  characterStyles: CharacterStyle[];
  documents: WritingDocument[];
  state: CharacterVoiceStateInputs;
  /** Add the records one hop away (4.71); the context budget decides how many fit. */
  includeLinkedRecords?: boolean;
}): CharacterVoiceContext {
  const resolver = createCharacterLinkResolver({
    categories: params.categories,
    entities: params.entities,
    characters: params.characters,
    sheets: params.sheets,
    actorResolutions: params.actorResolutions
  });
  const entity = resolver.getEntity(params.entityId);
  if (!entity) {
    throw new Error('This World Bible record is not a character.');
  }

  const orderedDocuments = sortWritingDocuments(params.documents);
  const sceneOrder =
    params.position.kind === 'scene' ? getSceneOrder(orderedDocuments, params.position.sceneId) : 0;
  if (params.position.kind === 'scene' && sceneOrder === 0) {
    throw new Error('That scene is no longer in this manuscript.');
  }
  const positionLabel = describePosition(params.position, orderedDocuments);
  const belongsToCharacter = (target: {targetType?: 'entity' | 'character'; targetId: string}) =>
    (target.targetType ?? 'entity') === 'entity'
      ? target.targetId === entity.id
      : resolver.resolveEntityId({characterId: target.targetId}) === entity.id;

  const sections: CharacterVoiceSection[] = [];

  const aliases = params.aliases.filter(belongsToCharacter);
  const aliasNames = Array.from(new Set(aliases.map((alias) => alias.alias.trim()).filter(Boolean)));
  sections.push({
    kind: 'canon-record',
    source: `Accepted canon: World Bible record - ${entity.name}`,
    content: [
      buildWorldBibleEntityContent(entity),
      aliasNames.length > 0 ? `Also known as: ${aliasNames.join(', ')}` : null
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n'),
    provenance: [
      {type: 'world-entity', id: entity.id},
      ...aliases.map((alias) => ({type: 'alias' as const, id: alias.id}))
    ]
  });

  const proposalStatusById = new Map(
    (params.factProposals ?? []).map((proposal) => [proposal.id, proposal.status])
  );
  const facts = params.canonicalFacts.filter(
    (fact) =>
      belongsToCharacter(fact) &&
      isAcceptedFact(fact, proposalStatusById) &&
      isFactValidAtPosition(fact, params.position, orderedDocuments)
  );
  const factItems = facts.map((fact) => {
    const validity = formatCanonicalFactValidity(fact, orderedDocuments);
    return {
      text: `- ${fact.factType.replace(/_/g, ' ')}: ${factValueText(fact)}${validity ? ` (${validity})` : ''}`,
      provenance: {type: 'canonical-fact' as const, id: fact.id},
      rank: FACT_TYPE_RANK[fact.factType] ?? 0
    };
  });
  sections.push({
    kind: 'accepted-facts',
    source: `Accepted canon facts - ${entity.name}`,
    content:
      factItems.length > 0
        ? factItems.map((item) => item.text).join('\n')
        : NO_ACCEPTED_FACTS,
    provenance: factItems.map((item) => item.provenance),
    items: factItems
  });

  const styleId = resolver.getCharacter(entity.id)?.characterStyleId;
  const style = styleId ? params.characterStyles.find((candidate) => candidate.id === styleId) : undefined;
  if (style) {
    sections.push({
      kind: 'dialogue-style',
      source: `Assigned dialogue style - ${entity.name}`,
      content: `Dialogue style: ${style.name}`,
      provenance: [{type: 'character-style', id: style.id}]
    });
  }

  const resolvedSheet = resolver.getSheet(entity.id);
  const sheet = resolvedSheet ? deriveCharacterSheetNames([resolvedSheet], [entity])[0] : null;
  const snapshot = sheet
    ? buildCharacterSnapshot({
        sheet,
        ruleset: params.state.ruleset,
        events: params.state.events,
        actorResolutions: params.actorResolutions,
        position:
          params.position.kind === 'latest'
            ? {kind: 'latest'}
            : {
                kind: 'scene',
                sceneOrder,
                moment: params.position.moment,
                cursorPosition: params.position.cursorPosition
              },
        runtimeModifiers: params.state.runtimeModifiers,
        statDefinitionNameById: params.state.statDefinitionNameById,
        resourceDefinitionNameById: params.state.resourceDefinitionNameById,
        compendiumEntries: params.state.compendiumEntries,
        entityById: new Map(params.entities.map((record) => [record.id, record]))
      })
    : null;
  if (sheet && snapshot) {
    sections.push({
      kind: 'story-state',
      source: `Story state at ${positionLabel} - ${entity.name}`,
      content: `${STORY_STATE_KNOWLEDGE_NOTE}\n${formatSnapshot(snapshot)}`,
      provenance: [{type: 'character-sheet', id: sheet.id}]
    });
  }

  if (params.includeLinkedRecords) {
    findLinkedRecords({entity, facts, entities: params.entities, aliases: params.aliases}).forEach((record) => {
      sections.push({
        kind: 'linked-record',
        source: `Accepted canon: linked World Bible record - ${record.name} (linked to ${entity.name})`,
        content: buildWorldBibleEntityContent(record),
        provenance: [{type: 'world-entity', id: record.id}]
      });
    });
  }

  return {
    entityId: entity.id,
    name: entity.name,
    position: params.position,
    positionLabel,
    sections,
    snapshot
  };
}
