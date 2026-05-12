import type {
  Character,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityKind,
  LoreEntityProposal,
  WorldEntity
} from '../../entityTypes';

interface ExtractLoreEntityParams {
  projectId: string;
  document: LoreDocument;
  links: LoreDocumentLink[];
  characters: Character[];
  entities: WorldEntity[];
}

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const titleCaseName = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

function pushProposal(
  proposals: LoreEntityProposal[],
  dedupe: Set<string>,
  params: {
    projectId: string;
    documentId: string;
    name: string;
    entityKind: LoreEntityKind;
    confidence: number;
    evidenceText: string;
    evidenceStart: number;
    existingMatch?: {targetType: 'character' | 'entity'; targetId: string};
  }
): void {
  const normalizedName = normalize(params.name);
  if (!normalizedName || normalizedName.length < 3) return;
  const dedupeKey = `${params.entityKind}|${normalizedName}`;
  if (dedupe.has(dedupeKey)) return;
  dedupe.add(dedupeKey);
  proposals.push({
    id: crypto.randomUUID(),
    projectId: params.projectId,
    loreDocumentId: params.documentId,
    name: titleCaseName(params.name),
    entityKind: params.entityKind,
    confidence: params.confidence,
    evidence: {
      start: params.evidenceStart,
      end: params.evidenceStart + params.evidenceText.length,
      text: params.evidenceText
    },
    targetType: params.existingMatch?.targetType,
    targetId: params.existingMatch?.targetId,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function findExistingMatch(
  name: string,
  characters: Character[],
  entities: WorldEntity[]
): {targetType: 'character' | 'entity'; targetId: string} | undefined {
  const normalizedName = normalize(name);
  const character = characters.find((entry) => normalize(entry.name) === normalizedName);
  if (character) {
    return {targetType: 'character', targetId: character.id};
  }
  const entity = entities.find((entry) => normalize(entry.name) === normalizedName);
  if (entity) {
    return {targetType: 'entity', targetId: entity.id};
  }
  return undefined;
}

const FACTION_PATTERNS: Array<{pattern: RegExp; kind: LoreEntityKind}> = [
  {pattern: /\bmember of (?:the )?([A-Z][A-Za-zÀ-ÿ' -]+ clan)\b/g, kind: 'faction'},
  {pattern: /\b([A-Z][A-Za-zÀ-ÿ' -]+ clan)\b/g, kind: 'faction'},
  {pattern: /\b([A-Z][A-Za-zÀ-ÿ' -]+ police)\b/g, kind: 'faction'},
  {pattern: /\b([A-Z][A-Za-zÀ-ÿ' -]+ force)\b/g, kind: 'faction'}
];

const CHARACTER_PATTERNS: Array<{pattern: RegExp; kind: LoreEntityKind}> = [
  {pattern: /\bpartnered with ([A-Z][A-Za-zÀ-ÿ' -]+)\b/g, kind: 'character'},
  {pattern: /\bbond with ([A-Z][A-Za-zÀ-ÿ' -]+)\b/g, kind: 'character'}
];

const LOCATION_PATTERNS: Array<{pattern: RegExp; kind: LoreEntityKind}> = [
  {pattern: /\bfrom ([A-Z][A-Za-zÀ-ÿ' -]+)\b/g, kind: 'location'}
];

const CONCEPT_PATTERNS: Array<{pattern: RegExp; kind: LoreEntityKind}> = [
  {pattern: /\b([A-Z][A-Za-zÀ-ÿ' -]+)\s*\(earth-based magical species\)/g, kind: 'concept'}
];

export function extractLoreEntityProposals(
  params: ExtractLoreEntityParams
): LoreEntityProposal[] {
  const proposals: LoreEntityProposal[] = [];
  const dedupe = new Set<string>();
  const text = params.document.content;
  const firstLinkedCharacter = params.links.find((link) => link.targetType === 'character');

  if (params.document.kind === 'character_dossier' || /character sheet/i.test(params.document.title)) {
    const titleMatch =
      params.document.title.match(/character sheet[:\s-]+(.+)/i) ??
      text.match(/^\s*[•*-]?\s*Name:\s*(.+)$/im);
    const candidateName = titleMatch?.[1]?.trim();
    if (titleMatch && candidateName && !firstLinkedCharacter) {
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        name: candidateName,
        entityKind: 'character',
        confidence: 0.96,
        evidenceText: titleMatch[0],
        evidenceStart: text.indexOf(titleMatch[0]),
        existingMatch: findExistingMatch(candidateName, params.characters, params.entities)
      });
    }
  }

  const patternGroups = [
    ...FACTION_PATTERNS,
    ...CHARACTER_PATTERNS,
    ...LOCATION_PATTERNS,
    ...CONCEPT_PATTERNS
  ];

  for (const matcher of patternGroups) {
    for (const match of text.matchAll(matcher.pattern)) {
      const candidateName = match[1]?.trim();
      if (!candidateName) continue;
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        name: candidateName,
        entityKind: matcher.kind,
        confidence: matcher.kind === 'character' ? 0.78 : 0.72,
        evidenceText: match[0],
        evidenceStart: match.index ?? 0,
        existingMatch: findExistingMatch(candidateName, params.characters, params.entities)
      });
    }
  }

  return proposals.sort((left, right) => left.evidence.start - right.evidence.start);
}
