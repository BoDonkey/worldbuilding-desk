import type {
  CanonicalFact,
  CanonicalFactType,
  CanonicalFactValue,
  LoreDocument,
  LoreDocumentLink,
  LoreFactProposal
} from '../../entityTypes';

interface ExtractionTarget {
  type: 'character' | 'entity';
  id: string;
  name: string;
}

interface ExtractLoreFactParams {
  projectId: string;
  document: LoreDocument;
  links: LoreDocumentLink[];
  knownTargets: ExtractionTarget[];
  existingFacts: CanonicalFact[];
}

const LABEL_TO_FACT_TYPE: Record<string, CanonicalFactType> = {
  age: 'age',
  occupation: 'occupation',
  background: 'background',
  family: 'background',
  education: 'background',
  'career path': 'background',
  height: 'appearance',
  build: 'appearance',
  hair: 'appearance',
  complexion: 'appearance',
  eyes: 'appearance',
  'general disposition': 'trait',
  strengths: 'trait',
  weaknesses: 'trait',
  hobbies: 'trait',
  'hobbies/interests': 'trait',
  'investigative skills': 'ability',
  'magical abilities': 'ability',
  'interpersonal skills': 'ability',
  'special traits': 'trait',
  'interpersonal relationships': 'relationship',
  'work relationships': 'relationship',
  'personal goals': 'goal',
  'professional goals': 'goal',
  'initial state': 'background',
  development: 'background',
  'traditionalist approach': 'trait',
  'partnering challenges': 'trait',
  'contrast with verdezian police': 'background'
};

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const formatFactValue = (value: CanonicalFactValue): string =>
  typeof value === 'string' ? value : `${value.label}:${value.value}`;

const relationshipLabels = [
  {pattern: /\bpartner(?:ed)? with ([^.]+)/i, label: 'partner_of'},
  {pattern: /\bstrong bond with ([^.]+)/i, label: 'bond_with'},
  {pattern: /\bmember of (?:the )?([^.]+)/i, label: 'member_of'}
];

function resolvePrimaryTarget(
  document: LoreDocument,
  links: LoreDocumentLink[],
  knownTargets: ExtractionTarget[]
): ExtractionTarget | null {
  const primaryLink =
    links.find((link) => link.relationship === 'primary_subject') ??
    (links.length === 1 ? links[0] : null);
  if (primaryLink) {
    const target = knownTargets.find(
      (entry) => entry.type === primaryLink.targetType && entry.id === primaryLink.targetId
    );
    if (target) return target;
  }

  const normalizedTitle = normalize(document.title);
  return (
    knownTargets.find((entry) => normalize(entry.name) === normalizedTitle) ?? null
  );
}

function pushProposal(
  proposals: LoreFactProposal[],
  dedupe: Set<string>,
  params: {
    projectId: string;
    documentId: string;
    target: ExtractionTarget | null;
    factType: CanonicalFactType;
    value: CanonicalFactValue;
    confidence: number;
    evidenceText: string;
    evidenceStart: number;
    existingFacts: CanonicalFact[];
  }
): void {
  const evidence = params.evidenceText.trim();
  if (!evidence) return;
  const dedupeKey = [
    params.target?.type ?? '',
    params.target?.id ?? '',
    params.factType,
    formatFactValue(params.value).toLowerCase()
  ].join('|');

  if (dedupe.has(dedupeKey)) return;

  const alreadyAccepted = params.existingFacts.some((fact) => {
    return (
      fact.targetType === params.target?.type &&
      fact.targetId === params.target?.id &&
      fact.factType === params.factType &&
      formatFactValue(fact.value).toLowerCase() === formatFactValue(params.value).toLowerCase()
    );
  });
  if (alreadyAccepted) return;

  dedupe.add(dedupeKey);
  proposals.push({
    id: crypto.randomUUID(),
    projectId: params.projectId,
    loreDocumentId: params.documentId,
    targetType: params.target?.type,
    targetId: params.target?.id,
    targetName: params.target?.name,
    factType: params.factType,
    value: params.value,
    confidence: params.confidence,
    evidence: {
      start: params.evidenceStart,
      end: params.evidenceStart + evidence.length,
      text: evidence
    },
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function extractRelationshipValues(text: string): CanonicalFactValue[] {
  const values: CanonicalFactValue[] = [];
  for (const matcher of relationshipLabels) {
    const match = text.match(matcher.pattern);
    if (match?.[1]) {
      values.push({label: matcher.label, value: match[1].trim()});
    }
  }
  return values;
}

function extractInlineMembership(text: string): string | null {
  const match = text.match(/\bmember of (?:the )?([^.]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractInlineHeritage(text: string): string | null {
  const match = text.match(/\bhybrid with ([^.]+)/i);
  if (match?.[1]) return match[1].trim();
  if (/heritage/i.test(text)) return text.trim();
  return null;
}

export function extractLoreFactProposals(
  params: ExtractLoreFactParams
): LoreFactProposal[] {
  const proposals: LoreFactProposal[] = [];
  const dedupe = new Set<string>();
  const target = resolvePrimaryTarget(
    params.document,
    params.links,
    params.knownTargets
  );
  const lines = params.document.content.split('\n');
  let cursor = 0;
  let currentSection = '';

  for (const line of lines) {
    const rawLine = line;
    const trimmed = rawLine.trim();
    const lineStart = cursor;
    cursor += rawLine.length + 1;

    if (!trimmed) continue;
    if (/^[A-Z][A-Za-z /'-]+:$/.test(trimmed)) {
      currentSection = trimmed.slice(0, -1);
      continue;
    }

    const bulletBody = trimmed.replace(/^[•*-]\s*/, '');
    if (/^name:/i.test(bulletBody)) {
      continue;
    }

    const labelMatch = bulletBody.match(/^([^:]+):\s*(.+)$/);
    if (labelMatch) {
      const label = normalize(labelMatch[1]);
      const value = labelMatch[2].trim();
      const factType = LABEL_TO_FACT_TYPE[label];

      if (factType) {
        pushProposal(proposals, dedupe, {
          projectId: params.projectId,
          documentId: params.document.id,
          target,
          factType,
          value,
          confidence: 0.85,
          evidenceText: trimmed,
          evidenceStart: lineStart + rawLine.indexOf(labelMatch[2]),
          existingFacts: params.existingFacts
        });
      }

      if (label === 'occupation') {
        for (const relationValue of extractRelationshipValues(value)) {
          pushProposal(proposals, dedupe, {
            projectId: params.projectId,
            documentId: params.document.id,
            target,
            factType: 'relationship',
            value: relationValue,
            confidence: 0.78,
            evidenceText: trimmed,
            evidenceStart: lineStart,
            existingFacts: params.existingFacts
          });
        }
      }

      if (label === 'background' || label === 'family') {
        const heritage = extractInlineHeritage(value);
        if (heritage) {
          pushProposal(proposals, dedupe, {
            projectId: params.projectId,
            documentId: params.document.id,
            target,
            factType: 'heritage',
            value: heritage,
            confidence: 0.74,
            evidenceText: trimmed,
            evidenceStart: lineStart,
            existingFacts: params.existingFacts
          });
        }
      }

      continue;
    }

    const membership = extractInlineMembership(bulletBody);
    if (membership) {
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        target,
        factType: 'membership',
        value: membership,
        confidence: 0.9,
        evidenceText: trimmed,
        evidenceStart: lineStart,
        existingFacts: params.existingFacts
      });
      continue;
    }

    const heritage = extractInlineHeritage(bulletBody);
    if (heritage) {
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        target,
        factType: 'heritage',
        value: heritage,
        confidence: 0.76,
        evidenceText: trimmed,
        evidenceStart: lineStart,
        existingFacts: params.existingFacts
      });
    }

    for (const relationValue of extractRelationshipValues(bulletBody)) {
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        target,
        factType: 'relationship',
        value: relationValue,
        confidence: 0.73,
        evidenceText: trimmed,
        evidenceStart: lineStart,
        existingFacts: params.existingFacts
      });
    }

    if (/^also known as /i.test(bulletBody)) {
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        target,
        factType: 'alias',
        value: bulletBody.replace(/^also known as /i, '').trim(),
        confidence: 0.92,
        evidenceText: trimmed,
        evidenceStart: lineStart,
        existingFacts: params.existingFacts
      });
      continue;
    }

    if (
      currentSection &&
      ['special traits', 'personality', 'skills', 'goals and motivations'].includes(
        normalize(currentSection)
      )
    ) {
      const sectionType =
        normalize(currentSection) === 'goals and motivations' ? 'goal' : 'trait';
      pushProposal(proposals, dedupe, {
        projectId: params.projectId,
        documentId: params.document.id,
        target,
        factType: sectionType,
        value: bulletBody,
        confidence: 0.62,
        evidenceText: trimmed,
        evidenceStart: lineStart,
        existingFacts: params.existingFacts
      });
    }
  }

  return proposals.sort((left, right) => left.evidence.start - right.evidence.start);
}
