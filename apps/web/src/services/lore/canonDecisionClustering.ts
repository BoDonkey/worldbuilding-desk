import type {
  CanonDecisionCluster,
  CanonDecisionSuppression,
  CanonicalFact,
  Character,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);

const similarity = (left: string, right: string): number => {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  let shortestSharedTokenLength = Infinity;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
      shortestSharedTokenLength = Math.min(shortestSharedTokenLength, token.length);
    }
  });
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (overlap === smallerSize && shortestSharedTokenLength >= 4) {
    return smallerSize === 1 ? 0.75 : 0.85;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
};

const formatFactValue = (value: CanonicalFact['value'] | LoreFactProposal['value']): string =>
  typeof value === 'string' ? value : `${value.label}: ${value.value}`;

interface BuildCanonDecisionClustersParams {
  projectId: string;
  entityProposals: LoreEntityProposal[];
  factProposals: LoreFactProposal[];
  canonicalFacts: CanonicalFact[];
  characters: Character[];
  entities: WorldEntity[];
  existingClusters?: CanonDecisionCluster[];
  suppressions?: CanonDecisionSuppression[];
}

export function buildCanonDecisionClusters(
  params: BuildCanonDecisionClustersParams
): CanonDecisionCluster[] {
  const clusters: CanonDecisionCluster[] = [];
  const now = Date.now();
  const existingById = new Map((params.existingClusters ?? []).map((cluster) => [cluster.id, cluster]));
  const suppressionMap = new Map(
    (params.suppressions ?? []).map((suppression) => [suppression.key, suppression])
  );

  const addCluster = (cluster: Omit<CanonDecisionCluster, 'createdAt' | 'updatedAt' | 'status' | 'resolution'>) => {
    const existing = existingById.get(cluster.id);
    clusters.push({
      ...cluster,
      status: existing?.status ?? 'open',
      resolution: existing?.resolution,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
  };

  params.entityProposals
    .filter((proposal) => proposal.status === 'proposed')
    .forEach((proposal) => {
      const candidates = [
        ...params.characters.map((character) => ({
          id: character.id,
          name: character.name,
          type: 'character' as const
        })),
        ...params.entities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: 'entity' as const
        }))
      ];
      const bestMatch = candidates
        .map((candidate) => ({
          ...candidate,
          score:
            normalize(candidate.name) === normalize(proposal.name)
              ? 1
              : similarity(candidate.name, proposal.name)
        }))
        .filter((candidate) => candidate.score >= 0.5)
        .sort((left, right) => right.score - left.score)[0];

      if (!bestMatch) return;
      const entitySuppressionKey = [
        normalize(proposal.name),
        normalize(bestMatch.name)
      ]
        .sort()
        .join('|');
      if (suppressionMap.has(`entity:${entitySuppressionKey}`)) {
        return;
      }

      const reasonCodes =
        bestMatch.score === 1
          ? ['exact_normalized_match']
          : bestMatch.name.toLowerCase().includes(proposal.name.toLowerCase()) ||
              proposal.name.toLowerCase().includes(bestMatch.name.toLowerCase())
            ? ['name_contains_other', 'high_token_overlap']
            : ['high_token_overlap'];

      addCluster({
        id: `entity:${proposal.id}:${bestMatch.type}:${bestMatch.id}`,
        projectId: params.projectId,
        kind: 'entity_identity',
        title: `${proposal.name} may match ${bestMatch.name}`,
        summary:
          `${proposal.name} looks similar to existing ${bestMatch.type === 'character' ? 'character' : 'world record'} ` +
          `"${bestMatch.name}". Decide whether to alias, keep separate, or accept as new.`,
        memberRefs: [
          {type: 'lore_entity_proposal', id: proposal.id},
          {
            type: bestMatch.type === 'character' ? 'character' : 'world_entity',
            id: bestMatch.id
          }
        ],
        suggestedResolution: bestMatch.score === 1 ? 'alias' : 'defer',
        reasonCodes
      });
    });

  params.factProposals
    .filter((proposal) => proposal.status === 'proposed' && proposal.targetType && proposal.targetId)
    .forEach((proposal) => {
      const conflict = params.canonicalFacts.find((fact) => {
        return (
          fact.targetType === proposal.targetType &&
          fact.targetId === proposal.targetId &&
          fact.factType === proposal.factType &&
          normalize(formatFactValue(fact.value)) !== normalize(formatFactValue(proposal.value))
        );
      });
      if (!conflict) return;
      const factSuppressionKey = [
        'fact',
        proposal.targetType,
        proposal.targetId,
        proposal.factType,
        normalize(formatFactValue(conflict.value)),
        normalize(formatFactValue(proposal.value))
      ].join('|');
      if (suppressionMap.has(factSuppressionKey)) {
        return;
      }

      addCluster({
        id: `fact:${proposal.id}:${conflict.id}`,
        projectId: params.projectId,
        kind: 'fact_conflict',
        title: `${proposal.factType.replace(/_/g, ' ')} conflict for ${proposal.targetName ?? proposal.targetId}`,
        summary:
          `The proposed value "${formatFactValue(proposal.value)}" conflicts with accepted canon ` +
          `"${formatFactValue(conflict.value)}".`,
        memberRefs: [
          {type: 'lore_fact_proposal', id: proposal.id},
          {type: 'canonical_fact', id: conflict.id}
        ],
        suggestedResolution: 'defer',
        reasonCodes: ['same_fact_type_same_target']
      });
    });

  return clusters
    .filter((cluster) => cluster.status !== 'resolved' || cluster.resolution === 'defer')
    .sort((left, right) => left.title.localeCompare(right.title));
}
