import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  CanonDecisionSuppression,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';
import {buildCanonDecisionClusters} from './canonDecisionClustering';
import {buildEntityDecisionSuppressionKey} from './canonDecisionSuppressionStorage';

const projectId = 'project-1';

const makeEntityProposal = (
  overrides: Partial<LoreEntityProposal>
): LoreEntityProposal => ({
  id: 'proposal-1',
  projectId,
  loreDocumentId: 'lore-doc-1',
  name: 'Unnamed',
  entityKind: 'character',
  confidence: 0.8,
  evidence: {
    start: 0,
    end: 7,
    text: 'Unnamed'
  },
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const makeWorldEntity = (overrides: Partial<WorldEntity>): WorldEntity => ({
  id: 'entity-1',
  projectId,
  categoryId: 'characters',
  name: 'Unnamed',
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const makeFactProposal = (overrides: Partial<LoreFactProposal>): LoreFactProposal => ({
  id: 'fact-proposal-1',
  projectId,
  loreDocumentId: 'lore-doc-1',
  targetType: 'entity',
  targetId: 'brannic',
  targetName: 'Brannic Halloway',
  factType: 'background',
  value: 'Compact service: a decade',
  confidence: 0.9,
  evidence: {start: 0, end: 20, text: 'Brannic served the Compact a decade.'},
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const makeCanonicalFact = (overrides: Partial<CanonicalFact>): CanonicalFact => ({
  id: 'fact-1',
  projectId,
  targetType: 'entity',
  targetId: 'brannic',
  targetName: 'Brannic Halloway',
  factType: 'background',
  value: 'Compact service: twenty years',
  acceptedAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('canonDecisionClustering', () => {
  it('clusters short-form proposals against fuller existing canon names', () => {
    const clusters = buildCanonDecisionClusters({
      projectId,
      entityProposals: [
        makeEntityProposal({
          id: 'proposal-camila',
          name: 'Camila',
          evidence: {
            start: 0,
            end: 6,
            text: 'Camila'
          }
        })
      ],
      factProposals: [],
      canonicalFacts: [],
      characters: [],
      entities: [
        makeWorldEntity({
          id: 'entity-camila',
          name: 'Camila Garcia deTerra'
        })
      ]
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      id: 'entity:proposal-camila:entity:entity-camila',
      kind: 'entity_identity',
      title: 'Camila may match Camila Garcia deTerra',
      suggestedResolution: 'defer',
      reasonCodes: ['name_contains_other', 'high_token_overlap']
    });
  });

  it('does not cluster tiny fragment matches as identity decisions', () => {
    const clusters = buildCanonDecisionClusters({
      projectId,
      entityProposals: [
        makeEntityProposal({
          id: 'proposal-de',
          name: 'de',
          evidence: {
            start: 0,
            end: 2,
            text: 'de'
          }
        })
      ],
      factProposals: [],
      canonicalFacts: [],
      characters: [],
      entities: [
        makeWorldEntity({
          id: 'entity-camila',
          name: 'Camila Garcia deTerra'
        })
      ]
    });

    expect(clusters).toEqual([]);
  });

  it('clusters historical pluralized names from the trust dogfood fixture', () => {
    const clusters = buildCanonDecisionClusters({
      projectId,
      entityProposals: [
        makeEntityProposal({
          id: 'proposal-compact',
          name: 'Compact of Cinders',
          entityKind: 'faction'
        })
      ],
      factProposals: [],
      canonicalFacts: [],
      characters: [],
      entities: [makeWorldEntity({id: 'compact', name: 'Cinder Compact'})]
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      kind: 'entity_identity',
      title: 'Compact of Cinders may match Cinder Compact'
    });
  });

  it('suppresses resolved short-form entity identity pairs', () => {
    const suppression: CanonDecisionSuppression = {
      id: 'suppression-1',
      projectId,
      kind: 'entity_identity',
      key: buildEntityDecisionSuppressionKey({
        proposalName: 'Camila',
        targetName: 'Camila Garcia deTerra'
      }),
      resolution: 'keep_separate',
      createdAt: 1,
      updatedAt: 1
    };

    const clusters = buildCanonDecisionClusters({
      projectId,
      entityProposals: [
        makeEntityProposal({
          id: 'proposal-camila',
          name: 'Camila'
        })
      ],
      factProposals: [],
      canonicalFacts: [],
      characters: [],
      entities: [
        makeWorldEntity({
          id: 'entity-camila',
          name: 'Camila Garcia deTerra'
        })
      ],
      suppressions: [suppression]
    });

    expect(clusters).toEqual([]);
  });

  it('forms the Brannic service conflict once one correctly targeted value is canon', () => {
    const clusters = buildCanonDecisionClusters({
      projectId,
      entityProposals: [],
      factProposals: [makeFactProposal({})],
      canonicalFacts: [makeCanonicalFact({})],
      characters: [],
      entities: [makeWorldEntity({id: 'brannic', name: 'Brannic Halloway'})]
    });

    expect(clusters).toEqual([
      expect.objectContaining({
        kind: 'fact_conflict',
        title: 'background conflict for Brannic Halloway',
        reasonCodes: ['same_fact_type_same_target'],
        memberRefs: expect.arrayContaining([
          {type: 'lore_fact_proposal', id: 'fact-proposal-1'},
          {type: 'canonical_fact', id: 'fact-1'}
        ])
      })
    ]);
  });
});
