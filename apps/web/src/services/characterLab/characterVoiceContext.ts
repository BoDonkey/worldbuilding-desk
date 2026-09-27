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
import {sortWritingDocuments} from '../../writingStorage';
import {
  createCharacterLinkResolver,
  type ActorResolution
} from '../characters/characterIdentity';
import {deriveCharacterSheetNames} from '../characters/characterSheetService';
import type {CharacterRuntimeModifiers} from '../compendium';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
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
  | 'story-state';

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
const isAcceptedFact = (
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
  sections.push({
    kind: 'accepted-facts',
    source: `Accepted canon facts - ${entity.name}`,
    content:
      facts.length > 0
        ? facts
            .map((fact) => {
              const validity = formatCanonicalFactValidity(fact, orderedDocuments);
              return `- ${fact.factType.replace(/_/g, ' ')}: ${factValueText(fact)}${validity ? ` (${validity})` : ''}`;
            })
            .join('\n')
        : 'No accepted facts are recorded for this character at this point.',
    provenance: facts.map((fact) => ({type: 'canonical-fact', id: fact.id}))
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

  return {
    entityId: entity.id,
    name: entity.name,
    position: params.position,
    positionLabel,
    sections,
    snapshot
  };
}
