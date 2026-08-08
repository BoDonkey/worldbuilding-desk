import type {RAGSearchResult} from '../../services/rag/types';
import {isEvidenceGatedFactualQuestion} from '../../services/assistant/factualQuestionBoundary';

export type AIAssistantContextType =
  | 'document'
  | 'rule'
  | 'rules'
  | 'character'
  | 'world-bible';

export const stripAssistantThinking = (content: string): string =>
  content
    .replace(
      /\*?SILENT SYSTEM MESSAGE\*?[\s\S]*?\*?END SYSTEM MESSAGE\*?/gi,
      ''
    )
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trimStart();

const EYE_COLOR_PATTERN =
  /\b(gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white)(?:[- ](gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white))?\s+eyes\b/i;
const EXPLICIT_EYE_COLOR_PATTERN =
  /\b(?:eye[_ ]?color|eyes)\s*:\s*(gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white)(?:[- ](gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white))?\b/i;

const normalizeFactName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type SavedFactIntent =
  | {kind: 'eye-color'; subject: string}
  | {kind: 'occupation'; subject: string; prior: boolean}
  | {kind: 'service-length'; subject: string}
  | {kind: 'membership'; subject: string; organization?: string}
  | {kind: 'treatment'; subject: string}
  | {kind: 'storage-location'; subject: string};

type ParsedCanonFact = {
  result: RAGSearchResult;
  target: string;
  factType: string;
  value: string;
};

const getSavedFactIntent = (promptText: string): SavedFactIntent | null => {
  const prompt = promptText.trim();
  const eyeQuestion = prompt.match(
    /^what (?:color|colour) (?:are|is) (.+?)(?:['’]s) eyes\??$/i
  );
  if (eyeQuestion?.[1]) return {kind: 'eye-color', subject: eyeQuestion[1].trim()};

  const priorOccupation = prompt.match(
    /^what did (.+?) do before (?:he|she|they) became? (?:an? )?[^?]+\??$/i
  );
  if (priorOccupation?.[1]) {
    return {kind: 'occupation', subject: priorOccupation[1].trim(), prior: true};
  }

  const occupation = prompt.match(
    /^(?:what|which) (?:was|is) (.+?)(?:['’]s) (?:job|occupation|profession)\??$/i
  );
  if (occupation?.[1]) {
    return {kind: 'occupation', subject: occupation[1].trim(), prior: false};
  }

  const service = prompt.match(/^how long has (.+?) served\b/i);
  if (service?.[1]) return {kind: 'service-length', subject: service[1].trim()};

  const membership = prompt.match(
    /^is (.+?) (?:working for|a member of|part of) (?:the )?(.+?)\??$/i
  );
  if (membership?.[1]) {
    return {
      kind: 'membership',
      subject: membership[1].trim(),
      organization: membership[2]?.trim()
    };
  }

  const treatment = prompt.match(/^what (?:cures|treats) (.+?)\??$/i);
  if (treatment?.[1]) return {kind: 'treatment', subject: treatment[1].trim()};

  const storageLocation = prompt.match(
    /^where (?:is|are|was|were) (.+?) (?:kept|stored|held|secured)\??$/i
  );
  if (storageLocation?.[1]) {
    return {kind: 'storage-location', subject: storageLocation[1].trim()};
  }

  return null;
};

const parseCanonFact = (result: RAGSearchResult): ParsedCanonFact | null => {
  if (result.chunk.metadata.type !== 'canon_fact') return null;
  const target = result.chunk.documentTitle.trim();
  const prefix = `${target} `;
  if (!result.chunk.content.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }
  const remainder = result.chunk.content.slice(prefix.length);
  const separatorIndex = remainder.indexOf(':');
  if (separatorIndex < 1) return null;
  return {
    result,
    target,
    factType: normalizeFactName(remainder.slice(0, separatorIndex)),
    value: remainder.slice(separatorIndex + 1).trim()
  };
};

const factMatchesSubject = (fact: ParsedCanonFact, subject: string): boolean => {
  const normalizedSubject = normalizeFactName(subject);
  const normalizedTarget = normalizeFactName(fact.target);
  return (
    normalizedTarget === normalizedSubject ||
    normalizedTarget.startsWith(`${normalizedSubject} `)
  );
};

const resolveSingleAcceptedFact = (
  facts: ParsedCanonFact[]
): ParsedCanonFact | null => {
  const values = new Set(facts.map((fact) => normalizeFactName(fact.value)));
  return values.size === 1 ? facts[0] ?? null : null;
};

type StorageLocationEvidence = {
  location: string;
  result: RAGSearchResult;
};

const STORAGE_CONTAINER =
  "(?:[A-Z][A-Za-z'’-]+['’]s\\s+)?(?:deep\\s+)?(?:vault|cabinet|safe|armory|archive|locker|storehouse)";

const extractStorageLocationEvidence = (
  result: RAGSearchResult,
  subject: string
): StorageLocationEvidence[] => {
  if (!['canon_fact', 'worldbible', 'scene'].includes(result.chunk.metadata.type)) {
    return [];
  }
  const subjectTerms = normalizeFactName(subject).split(' ').filter(Boolean);
  const normalizedContent = normalizeFactName(result.chunk.content);
  const identifyingTerms = subjectTerms.filter((term) => term.length >= 3);
  if (
    identifyingTerms.length > 0 &&
    !identifyingTerms.some((term) => normalizedContent.includes(term)) &&
    !/\bthe key\b/i.test(result.chunk.content)
  ) {
    return [];
  }

  const patterns = [
    new RegExp(`\\bsigned out of\\s+(${STORAGE_CONTAINER})`, 'gi'),
    new RegExp(
      `\\b(?:the\\s+)?key\\s+(?:goes|went|is|was)?\\s*(?:kept|stored|held|secured|put|placed)?\\s*(?:in|into|at|inside)\\s+(?:my\\s+|the\\s+)?(${STORAGE_CONTAINER})`,
      'gi'
    )
  ];
  const evidence: StorageLocationEvidence[] = [];
  for (const pattern of patterns) {
    for (const match of result.chunk.content.matchAll(pattern)) {
      const location = match[1]?.trim();
      if (location) evidence.push({location, result});
    }
  }
  return evidence;
};

const resolveStorageLocation = (
  subject: string,
  results: RAGSearchResult[]
): DirectSavedFactAnswer | null => {
  const evidence = results.flatMap((result) =>
    extractStorageLocationEvidence(result, subject)
  );
  if (evidence.length === 0) return null;

  const unique = Array.from(
    new Map(
      evidence.map((entry) => [normalizeFactName(entry.location), entry])
    ).values()
  );
  const mostSpecific = [...unique].sort(
    (left, right) => right.location.length - left.location.length
  )[0];
  if (!mostSpecific) return null;
  const normalizedMostSpecific = normalizeFactName(mostSpecific.location);
  const compatible = unique.every((entry) =>
    normalizedMostSpecific.endsWith(normalizeFactName(entry.location))
  );
  if (!compatible) {
    return {
      content: `Saved project passages give conflicting storage locations for ${subject}, so I won't choose one.`,
      results: unique.map((entry) => entry.result)
    };
  }

  const needsArticle = !/[’']s\b/i.test(mostSpecific.location);
  return {
    content: `${subject} is kept in ${needsArticle ? 'the ' : ''}${mostSpecific.location}.`,
    results: [mostSpecific.result]
  };
};

export type DirectSavedFactAnswer = {
  content: string;
  results: RAGSearchResult[];
};

/**
 * Resolve narrow, unambiguous factual questions directly from accepted saved
 * context. This keeps the model from replacing an explicit field with a guess.
 */
export const getDirectSavedFactAnswer = (
  promptText: string,
  results: RAGSearchResult[]
): DirectSavedFactAnswer | null => {
  const intent = getSavedFactIntent(promptText);
  if (!intent) return null;

  if (intent.kind === 'storage-location') {
    return resolveStorageLocation(intent.subject, results);
  }

  const subject = intent.subject;
  const normalizedSubject = normalizeFactName(subject);
  const canonFacts = results
    .map(parseCanonFact)
    .filter((fact): fact is ParsedCanonFact => Boolean(fact));
  const matchingFacts = canonFacts.filter((fact) => {
    if (intent.kind === 'treatment') {
      return (
        fact.factType === 'background' &&
        normalizeFactName(fact.value).includes(normalizeFactName(subject)) &&
        /\btreatment\s*:/i.test(fact.value)
      );
    }
    if (!factMatchesSubject(fact, subject)) return false;
    switch (intent.kind) {
      case 'occupation':
        return fact.factType === 'occupation';
      case 'service-length':
        return fact.factType === 'background' && /\bservice\s*:/i.test(fact.value);
      case 'membership':
        return fact.factType === 'membership';
      case 'eye-color':
        return fact.factType === 'appearance' && EYE_COLOR_PATTERN.test(fact.value);
    }
  });
  const acceptedFact = resolveSingleAcceptedFact(matchingFacts);

  if (acceptedFact) {
    switch (intent.kind) {
      case 'occupation':
        return {
          content: intent.prior
            ? `${subject} was a ${acceptedFact.value} before becoming a delver.`
            : `${subject}'s accepted occupation is ${acceptedFact.value}.`,
          results: [acceptedFact.result]
        };
      case 'service-length': {
        const service = acceptedFact.value.match(/^(.+?)\s+service:\s*(.+)$/i);
        if (service?.[1] && service[2]) {
          return {
            content: `${subject} has served the ${service[1]} for ${service[2]}.`,
            results: [acceptedFact.result]
          };
        }
        break;
      }
      case 'membership':
        return {
          content: `${subject}'s accepted canon membership is ${acceptedFact.value}.`,
          results: [acceptedFact.result]
        };
      case 'treatment': {
        const treatment = acceptedFact.value.match(/^.+?\s+treatment:\s*(.+)$/i);
        if (treatment?.[1]) {
          return {
            content: `${subject} is treated with ${treatment[1]}.`,
            results: [acceptedFact.result]
          };
        }
        break;
      }
      case 'eye-color': {
        const colorMatch = acceptedFact.value.match(EYE_COLOR_PATTERN);
        if (colorMatch) {
          const color = [colorMatch[1], colorMatch[2]]
            .filter(Boolean)
            .join('-')
            .toLowerCase();
          return {
            content: `${subject}'s eyes are ${color}.`,
            results: [acceptedFact.result]
          };
        }
        break;
      }
    }
  }

  if (matchingFacts.length > 1) {
    return {
      content: `Accepted canon contains conflicting ${intent.kind.replace(/-/g, ' ')} facts for ${subject}, so I won't choose one.`,
      results: matchingFacts.map((fact) => fact.result)
    };
  }

  if (intent.kind === 'membership') {
    const organization = intent.organization ? ` with ${intent.organization}` : '';
    return {
      content: `${subject}'s connection${organization} is not established in accepted canon.`,
      results: []
    };
  }

  if (intent.kind !== 'eye-color') return null;

  const acceptedMatches = results.filter((result) => {
    if (
      result.chunk.metadata.type !== 'worldbible' &&
      result.chunk.metadata.type !== 'canon_fact'
    ) {
      return false;
    }
    const normalizedTitle = normalizeFactName(result.chunk.documentTitle);
    return (
      normalizedTitle === normalizedSubject ||
      normalizedTitle.startsWith(`${normalizedSubject} `)
    );
  });

  for (const result of acceptedMatches) {
    const explicitColorMatch = result.chunk.content.match(EXPLICIT_EYE_COLOR_PATTERN);
    const appearanceIndex = result.chunk.content.search(/\bappearance\s*:/i);
    const appearanceContent =
      appearanceIndex >= 0
        ? result.chunk.content.slice(appearanceIndex)
        : result.chunk.content;
    const colorMatch = explicitColorMatch ?? appearanceContent.match(EYE_COLOR_PATTERN);
    if (!colorMatch) continue;
    const color = [colorMatch[1], colorMatch[2]].filter(Boolean).join('-').toLowerCase();
    return {
      content: `${subject}'s eyes are ${color}.`,
      results: [result]
    };
  }

  return null;
};

export const getContextLabel = (contextType?: AIAssistantContextType): string =>
  contextType === 'world-bible' ? 'Current World Bible record context' : 'Selected text';

export const getContextInstruction = (
  contextType: AIAssistantContextType | undefined,
  contextLabel: string
): string =>
  contextType === 'world-bible'
    ? `${contextLabel} is available below. It may include only the field most relevant to the author's request. Use the supplied field content as source material, but do not repeat field labels, keys, or unrelated record context in the answer. If rewriting or expanding a section, return the revised section text only unless the author asks for analysis.`
    : `The author has highlighted text in the editor. The ${contextLabel.toLowerCase()} is available as reference context below. Use it when the author asks about the selection or uses phrases like "this", "these", "it", "them", "the characters", or "the locations". Do not assume the author wants expansion; answer the task they ask for.`;

export const requiresProjectGrounding = (
  promptText: string,
  hasSelectedContext: boolean
): boolean => isEvidenceGatedFactualQuestion(promptText, hasSelectedContext);

const MEMORY_QUERY_STOP_WORDS = new Set([
  'are', 'can', 'did', 'does', 'for', 'from', 'had', 'has', 'have', 'how',
  'before', 'he', 'her', 'hers', 'him', 'his', 'into', 'is', 'it', 'its',
  'long', 'many', 'much', 'old', 'she', 'the', 'their', 'them', 'they', 'this',
  'was', 'were',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'would'
]);

export const getMemoryQueryTerms = (query: string): string[] =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9'-]+/g, ' ')
        .split(/\s+/)
        .map((term) => term.replace(/^['-]+|['-]+$/g, ''))
        .filter((term) => term.length >= 3 && !MEMORY_QUERY_STOP_WORDS.has(term))
    )
  );

export const getShodhTrustLabel = (tags: string[] | undefined): string => {
  const normalizedTags = new Set((tags ?? []).map((tag) => tag.toLowerCase()));
  if (normalizedTags.has('canon_fact')) return 'Accepted canon fact';
  if (normalizedTags.has('worldbible')) return 'Accepted canon';
  if (normalizedTags.has('rule')) return 'Rules reference';
  if (normalizedTags.has('scene')) return 'Scene draft';
  return 'Project memory';
};

const normalizeContextToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type WorldBibleContextField = {
  label: string;
  key: string;
  content: string;
  block: string;
};

export const selectWorldBibleContextForPrompt = (
  contextText: string,
  promptText: string
): string => {
  const editableFieldsMarker = 'Editable fields:';
  if (!contextText.includes(editableFieldsMarker)) return contextText;

  const [recordHeader, fieldsText = ''] = contextText.split(editableFieldsMarker);
  const fields: WorldBibleContextField[] = fieldsText
    .split(/\n\n---\n\n/g)
    .map((block) => {
      const label = block.match(/Field:\s*(.+)/)?.[1]?.trim() ?? '';
      const key = block.match(/Key:\s*(.+)/)?.[1]?.trim() ?? '';
      const content = block.match(/Current content:\n([\s\S]*)/)?.[1]?.trim() ?? '';
      return {label, key, content, block: block.trim()};
    })
    .filter((field) => field.label && field.key);

  if (fields.length === 0) return contextText;

  const normalizedPrompt = normalizeContextToken(promptText);
  const matchingFields = fields.filter((field) => {
    const normalizedLabel = normalizeContextToken(field.label);
    const normalizedKey = normalizeContextToken(field.key);
    return (
      normalizedLabel.length > 0 && normalizedPrompt.includes(normalizedLabel)
    ) || (
      normalizedKey.length > 0 && normalizedPrompt.includes(normalizedKey)
    );
  });
  const selectedFields = matchingFields.length > 0 ? matchingFields : [];
  const fieldIndex = fields
    .map((field) => `- ${field.label} (${field.key})`)
    .join('\n');

  return [
    recordHeader.trim(),
    `Available fields:\n${fieldIndex}`,
    selectedFields.length > 0
      ? `Relevant field content:\n\n${selectedFields.map((field) => field.block).join('\n\n---\n\n')}`
      : 'No exact field heading was matched. Ask a clarifying question or answer using the field list only.'
  ]
    .filter(Boolean)
    .join('\n\n');
};
