import type {RAGSearchResult} from '../rag/types';
import {normalizeNameLoose} from '../names/nameMatching';

/**
 * Narrow factual questions answered straight from accepted saved facts
 * (moved from AIAssistant.helpers, 3.44). No model is involved.
 */

const EYE_COLOR_PATTERN =
  /\b(gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white)(?:[- ](gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white))?\s+eyes\b/i;
const EXPLICIT_EYE_COLOR_PATTERN =
  /\b(?:eye[_ ]?color|eyes)\s*:\s*(gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white)(?:[- ](gray|grey|blue|brown|green|hazel|amber|black|violet|red|golden?|silver|white))?\b/i;

type SavedFactIntent =
  | {kind: 'eye-color'; subject: string}
  | {kind: 'occupation'; subject: string}
  | {kind: 'service-length'; subject: string}
  | {kind: 'membership'; subject: string; organization?: string}
  | {kind: 'treatment'; subject: string};

type ParsedCanonFact = {
  result: RAGSearchResult;
  target: string;
  factType: string;
  value: string;
  validity?: string;
};

const getSavedFactIntent = (promptText: string): SavedFactIntent | null => {
  const prompt = promptText.trim();
  const eyeQuestion = prompt.match(
    /^what (?:color|colour) (?:are|is) (.+?)(?:['’]s) eyes\??$/i
  );
  if (eyeQuestion?.[1]) return {kind: 'eye-color', subject: eyeQuestion[1].trim()};

  // A question about an earlier job is still answered from the accepted
  // occupation fact, so working notes cannot supply a guess. Canon does not
  // record when that occupation held, so the answer never claims an order.
  const priorOccupation = prompt.match(
    /^what did (.+?) do before (?:he|she|they) became? (?:an? )?[^?]+\??$/i
  );
  if (priorOccupation?.[1]) {
    return {kind: 'occupation', subject: priorOccupation[1].trim()};
  }

  const occupation = prompt.match(
    /^(?:what|which) (?:was|is) (.+?)(?:['’]s) (?:job|occupation|profession)\??$/i
  );
  if (occupation?.[1]) {
    return {kind: 'occupation', subject: occupation[1].trim()};
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
  const rawValue = remainder.slice(separatorIndex + 1).trim();
  const validityMatch = rawValue.match(/^(.*) \(((?:from|before|within) .+)\)$/i);
  return {
    result,
    target,
    factType: normalizeNameLoose(remainder.slice(0, separatorIndex)),
    value: validityMatch?.[1]?.trim() ?? rawValue,
    validity: validityMatch?.[2]?.trim()
  };
};

const stateValidity = (content: string, fact: ParsedCanonFact): string =>
  fact.validity ? `${content} This fact applies ${fact.validity}.` : content;

const factMatchesSubject = (fact: ParsedCanonFact, subject: string): boolean => {
  const normalizedSubject = normalizeNameLoose(subject);
  const normalizedTarget = normalizeNameLoose(fact.target);
  return (
    normalizedTarget === normalizedSubject ||
    normalizedTarget.startsWith(`${normalizedSubject} `)
  );
};

const resolveSingleAcceptedFact = (
  facts: ParsedCanonFact[]
): ParsedCanonFact | null => {
  const values = new Set(facts.map((fact) => normalizeNameLoose(fact.value)));
  return values.size === 1 ? facts[0] ?? null : null;
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

  const subject = intent.subject;
  const normalizedSubject = normalizeNameLoose(subject);
  const canonFacts = results
    .map(parseCanonFact)
    .filter((fact): fact is ParsedCanonFact => Boolean(fact));
  const matchingFacts = canonFacts.filter((fact) => {
    if (intent.kind === 'treatment') {
      return (
        fact.factType === 'background' &&
        normalizeNameLoose(fact.value).includes(normalizeNameLoose(subject)) &&
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
          content: stateValidity(
            `${subject}'s accepted occupation is ${acceptedFact.value}.`,
            acceptedFact
          ),
          results: [acceptedFact.result]
        };
      case 'service-length': {
        const service = acceptedFact.value.match(/^(.+?)\s+service:\s*(.+)$/i);
        if (service?.[1] && service[2]) {
          return {
            content: stateValidity(`${subject} has served the ${service[1]} for ${service[2]}.`, acceptedFact),
            results: [acceptedFact.result]
          };
        }
        break;
      }
      case 'membership':
        return {
          content: stateValidity(`${subject}'s accepted canon membership is ${acceptedFact.value}.`, acceptedFact),
          results: [acceptedFact.result]
        };
      case 'treatment': {
        const treatment = acceptedFact.value.match(/^.+?\s+treatment:\s*(.+)$/i);
        if (treatment?.[1]) {
          return {
            content: stateValidity(`${subject} is treated with ${treatment[1]}.`, acceptedFact),
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
            content: stateValidity(`${subject}'s eyes are ${color}.`, acceptedFact),
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
    const normalizedTitle = normalizeNameLoose(result.chunk.documentTitle);
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
