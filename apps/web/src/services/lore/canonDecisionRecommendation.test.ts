import {describe, expect, it} from 'vitest';
import {parseCanonDecisionRecommendation} from './canonDecisionRecommendation';

const entityResponse = (suggestedAction: string) =>
  '1. Grounded Signals\nBoth records share a distinctive alias.\n\n' +
  '2. Ambiguities\nThe evidence excerpt is short.\n\n' +
  '3. Decision Options\nAlias, accept new, keep separate, reject, or defer.\n\n' +
  '4. Recommended Next Step\nThe shared alias is a strong signal; alias this candidate to the existing record.\n\n' +
  `Suggested Action: ${suggestedAction}`;

const factResponse = (suggestedAction: string) =>
  '1. Grounded Signals\nThe new value is directly quoted.\n\n' +
  '2. Ambiguities\nNone found.\n\n' +
  '3. Decision Options\nAccept update, keep separate, reject, or defer.\n\n' +
  '4. Recommended Next Step\nThe newer quote is more specific; accept the update.\n\n' +
  `Suggested Action: ${suggestedAction}`;

describe('parseCanonDecisionRecommendation', () => {
  it('parses a valid entity_identity recommendation and its rationale', () => {
    const result = parseCanonDecisionRecommendation(entityResponse('alias'), 'entity_identity');
    expect(result).toEqual({
      action: 'alias',
      rationale: 'The shared alias is a strong signal; alias this candidate to the existing record.'
    });
  });

  it('parses a valid fact_conflict recommendation and its rationale', () => {
    const result = parseCanonDecisionRecommendation(factResponse('accept_update'), 'fact_conflict');
    expect(result).toEqual({
      action: 'accept_update',
      rationale: 'The newer quote is more specific; accept the update.'
    });
  });

  it('returns null for "none"', () => {
    expect(parseCanonDecisionRecommendation(entityResponse('none'), 'entity_identity')).toBeNull();
  });

  it('returns null when no Suggested Action line is present', () => {
    expect(parseCanonDecisionRecommendation('1. Grounded Signals\nSomething.', 'entity_identity')).toBeNull();
  });

  it('returns null for an unrecognized token', () => {
    expect(parseCanonDecisionRecommendation(entityResponse('merge_records'), 'entity_identity')).toBeNull();
  });

  it('rejects a token that is valid in general but not for this cluster kind', () => {
    // "alias" only ever applies to entity_identity clusters.
    expect(parseCanonDecisionRecommendation(factResponse('alias'), 'fact_conflict')).toBeNull();
  });

  it('rejects "accept_update" for an entity_identity cluster', () => {
    expect(parseCanonDecisionRecommendation(entityResponse('accept_update'), 'entity_identity')).toBeNull();
  });

  it('is tolerant of trailing whitespace and case on the tag line', () => {
    const content = `${entityResponse('KEEP_SEPARATE')}  \n  `;
    const result = parseCanonDecisionRecommendation(content, 'entity_identity');
    expect(result?.action).toBe('keep_separate');
  });

  it('is still parseable mid-stream once the full tag has arrived', () => {
    const streamed = entityResponse('defer').slice(0, -1); // truncate the final char
    expect(parseCanonDecisionRecommendation(streamed, 'entity_identity')).toBeNull();
  });
});
