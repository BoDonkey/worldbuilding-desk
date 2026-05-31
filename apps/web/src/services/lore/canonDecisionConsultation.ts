import type {
  CanonDecisionCluster,
  CanonicalFact,
  Character,
  LoreDocument,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity
} from '../../entityTypes';

const formatFactValue = (value: CanonicalFact['value'] | LoreFactProposal['value']): string =>
  typeof value === 'string' ? value : `${value.label}: ${value.value}`;

const compact = (value: string | undefined, limit = 280): string => {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
};

interface BuildCanonDecisionConsultationPromptParams {
  cluster: CanonDecisionCluster;
  entityProposal?: LoreEntityProposal | null;
  factProposal?: LoreFactProposal | null;
  canonicalFact?: CanonicalFact | null;
  targetCharacter?: Character | null;
  targetEntity?: WorldEntity | null;
  sourceDocument?: LoreDocument | null;
}

export function buildCanonDecisionConsultationPrompt(
  params: BuildCanonDecisionConsultationPromptParams
): {
  searchQuery: string;
  systemPrompt: string;
  userPrompt: string;
} {
  const {
    cluster,
    entityProposal,
    factProposal,
    canonicalFact,
    targetCharacter,
    targetEntity,
    sourceDocument
  } = params;

  const targetRecord = targetCharacter ?? targetEntity ?? null;
  const targetKind = targetCharacter ? 'character' : targetEntity ? 'world entity' : 'canon anchor';
  const targetNotes =
    targetCharacter?.description ||
    targetCharacter?.fields?.notes?.toString() ||
    targetEntity?.fields?.notes?.toString() ||
    '';

  const systemPrompt =
    'You are a canon-decision rubber-duck for a fiction worldbuilding tool. ' +
    'Your job is to help the author reason about ambiguity, not to decide canon. ' +
    'Do not invent hidden evidence. Distinguish grounded signals from assumptions. ' +
    'Do not say "merge automatically" or imply the database should change without author approval. ' +
    'Be concise and practical.\n\n' +
    'Return exactly these sections:\n' +
    '1. Grounded Signals\n' +
    '2. Ambiguities\n' +
    '3. Decision Options\n' +
    '4. Recommended Next Step\n\n' +
    'Under Decision Options, compare only the actions relevant to this cluster, such as alias, accept new, keep separate, accept update, reject, or defer.';

  if (cluster.kind === 'entity_identity' && entityProposal) {
    const targetName = targetRecord?.name ?? 'No existing match';
    const searchQuery = `${entityProposal.name} ${targetName} ${entityProposal.evidence.text}`.trim();
    const userPrompt =
      `Cluster Type: Entity identity\n` +
      `Title: ${cluster.title}\n` +
      `Summary: ${cluster.summary}\n` +
      `Reason codes: ${cluster.reasonCodes.join(', ')}\n\n` +
      `Proposed entity:\n` +
      `- Name: ${entityProposal.name}\n` +
      `- Kind: ${entityProposal.entityKind}\n` +
      `- Source lore document: ${sourceDocument?.title ?? 'Unknown'}\n` +
      `- Evidence excerpt: ${entityProposal.evidence.text}\n\n` +
      `Existing candidate match:\n` +
      `- Name: ${targetName}\n` +
      `- Record type: ${targetKind}\n` +
      `${targetNotes ? `- Existing notes: ${compact(targetNotes)}\n` : ''}` +
      `\nTask:\n` +
      `Help the author evaluate whether this looks like the same canon entity, a likely alias, or a distinct record. ` +
      `Call out what is strongly grounded in the evidence versus what would still be a guess.`;

    return {searchQuery, systemPrompt, userPrompt};
  }

  if (cluster.kind === 'fact_conflict' && factProposal && canonicalFact) {
    const targetName = canonicalFact.targetName ?? factProposal.targetName ?? targetRecord?.name ?? factProposal.targetId ?? 'Unknown target';
    const searchQuery = `${targetName} ${factProposal.factType} ${formatFactValue(factProposal.value)}`.trim();
    const userPrompt =
      `Cluster Type: Fact conflict\n` +
      `Title: ${cluster.title}\n` +
      `Summary: ${cluster.summary}\n` +
      `Reason codes: ${cluster.reasonCodes.join(', ')}\n\n` +
      `Target anchor:\n` +
      `- Name: ${targetName}\n` +
      `- Record type: ${factProposal.targetType}\n` +
      `${targetNotes ? `- Existing notes: ${compact(targetNotes)}\n` : ''}` +
      `\nProposed fact:\n` +
      `- Fact type: ${factProposal.factType}\n` +
      `- Proposed value: ${formatFactValue(factProposal.value)}\n` +
      `- Source lore document: ${sourceDocument?.title ?? 'Unknown'}\n` +
      `- Evidence excerpt: ${factProposal.evidence.text}\n\n` +
      `Current accepted canon:\n` +
      `- Fact type: ${canonicalFact.factType}\n` +
      `- Accepted value: ${formatFactValue(canonicalFact.value)}\n` +
      `${canonicalFact.evidenceText ? `- Accepted evidence excerpt: ${canonicalFact.evidenceText}\n` : ''}` +
      `\nTask:\n` +
      `Help the author decide whether this looks like a real canon update, an additive nuance that should stay separate, or a proposal that should be rejected or deferred. ` +
      `Do not assume newer text is automatically truer.`;

    return {searchQuery, systemPrompt, userPrompt};
  }

  return {
    searchQuery: `${cluster.title} ${cluster.summary}`.trim(),
    systemPrompt,
    userPrompt:
      `Cluster Type: ${cluster.kind}\n` +
      `Title: ${cluster.title}\n` +
      `Summary: ${cluster.summary}\n` +
      `Reason codes: ${cluster.reasonCodes.join(', ')}\n\n` +
      `Help the author reason through the safest next canon decision.`
  };
}
