import type {
  Character,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityKind,
  LoreEntityProposal,
  WorldEntity
} from '../../entityTypes';
import {normalizeCanonText} from '../consistency/textMatcher';

interface ExtractLoreEntityParams {
  projectId: string;
  document: LoreDocument;
  links: LoreDocumentLink[];
  characters: Character[];
  entities: WorldEntity[];
}

const normalize = normalizeCanonText;

const titleCaseName = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) =>
      index > 0 && /^(?:a|an|de|of|the)$/i.test(word)
        ? word.toLowerCase()
        : word.replace(/^\w/, (char) => char.toUpperCase())
    )
    .join(' ');

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
  {
    pattern: /\bmember of (?:the )?([A-Z][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Z][A-Za-zÀ-ÿ'’-]*)*\s+clan)\b/g,
    kind: 'faction'
  },
  {
    pattern: /\b([A-Z][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Z][A-Za-zÀ-ÿ'’-]*)*\s+clan)\b/g,
    kind: 'faction'
  },
  {
    pattern: /\b([A-Z][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Z][A-Za-zÀ-ÿ'’-]*)*\s+police)\b/g,
    kind: 'faction'
  },
  {
    pattern: /\b([A-Z][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Z][A-Za-zÀ-ÿ'’-]*)*\s+force)\b/g,
    kind: 'faction'
  }
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

const NATURAL_PROSE_PATTERNS: Array<{pattern: RegExp; kind: LoreEntityKind}> = [
  {pattern: /\boriginal name,[ \t]+(?:the[ \t]+)?([A-Z][A-Za-z'’-]+(?:[ \t]+(?:of[ \t]+)?[A-Z][A-Za-z'’-]+)+)/g, kind: 'faction'},
  {pattern: /\b(?:the[ \t]+)?([A-Z][A-Za-z'’-]+(?:[ \t]+(?:of[ \t]+)?[A-Z][A-Za-z'’-]+)*[ \t]+Compact)\b/g, kind: 'faction'},
  {pattern: /\b(?:the[ \t]+)?([A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z][A-Za-z'’-]+)*[ \t]+(?:Council|Court|Guild))\b(?![ \t]+clan)/g, kind: 'faction'},
  {pattern: /\b(?:the[ \t]+)?([A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z][A-Za-z'’-]+)*[ \t]+(?:Door|Harbor|House|Row|Vault|Walk))\b/g, kind: 'location'},
  {pattern: /\b([A-Z][A-Za-z'’-]+(?:[ \t]+[A-Z][A-Za-z'’-]+)*[ \t]+(?:Key|Lantern|Draught))\b/g, kind: 'item'},
  {pattern: /\b([A-Z][A-Za-z'’-]+\s+knife)\b/g, kind: 'item'},
  {pattern: /\b(?:mother|father|brother|warden),?\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?)\b/g, kind: 'character'},
  {pattern: /\bNotable residents[^:]*:\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+)\b/g, kind: 'character'},
  {pattern: /^([A-Z][A-Za-z'’-]+\s+[A-Z][A-Za-z'’-]+),\s+Warden\b/gm, kind: 'character'}
];

function extractTitleCandidates(document: LoreDocument): Array<{name: string; kind: LoreEntityKind}> {
  const heading = document.content.match(/^#\s+(.+)$/m)?.[1] ?? document.title;
  const subject = heading.split(/\s+[—–-]\s+/).slice(1).join(' — ').trim();
  if (!subject) return [];
  if (/^character dossier/i.test(heading)) {
    return [{name: subject, kind: 'character'}];
  }
  if (/^faction notes/i.test(heading)) {
    return [{name: subject.replace(/^the\s+/i, ''), kind: 'faction'}];
  }
  if (/^place notes/i.test(heading)) {
    return subject
      .split(/\s+and\s+/i)
      .map((name) => ({name: name.replace(/^the\s+/i, ''), kind: 'location' as const}));
  }
  return [];
}

export function extractLoreEntityProposals(
  params: ExtractLoreEntityParams
): LoreEntityProposal[] {
  const proposals: LoreEntityProposal[] = [];
  const dedupe = new Set<string>();
  const text = params.document.content;
  const firstLinkedCharacter = params.links.find((link) => link.targetType === 'character');
  const linkedTargetIds = new Set(params.links.map((link) => link.targetId));

  for (const candidate of extractTitleCandidates(params.document)) {
    const existingMatch = findExistingMatch(candidate.name, params.characters, params.entities);
    if (existingMatch && linkedTargetIds.has(existingMatch.targetId)) continue;
    const evidenceText = text.match(/^#\s+.+$/m)?.[0] ?? params.document.title;
    pushProposal(proposals, dedupe, {
      projectId: params.projectId,
      documentId: params.document.id,
      name: candidate.name,
      entityKind: candidate.kind,
      confidence: 0.96,
      evidenceText,
      evidenceStart: Math.max(0, text.indexOf(evidenceText)),
      existingMatch
    });
  }

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
    ...CONCEPT_PATTERNS,
    ...NATURAL_PROSE_PATTERNS
  ];

  for (const matcher of patternGroups) {
    for (const match of text.matchAll(matcher.pattern)) {
      const candidateName = match[1]?.trim().replace(/^the\s+/i, '');
      if (!candidateName) continue;
      const existingMatch = findExistingMatch(candidateName, params.characters, params.entities);
      if (existingMatch && linkedTargetIds.has(existingMatch.targetId)) continue;
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        name: candidateName,
        entityKind: matcher.kind,
        confidence: matcher.kind === 'character' ? 0.78 : 0.72,
        evidenceText: match[0],
        evidenceStart: match.index ?? 0,
        existingMatch
      });
    }
  }

  return proposals.sort((left, right) => left.evidence.start - right.evidence.start);
}
