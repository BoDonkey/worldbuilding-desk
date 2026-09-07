import {describe, expect, it} from 'vitest';
import {parseProgressionContinuityVerdict} from './progressionContinuityVerdict';

describe('parseProgressionContinuityVerdict', () => {
  it('parses a finding verdict with its rationale', () => {
    const result = parseProgressionContinuityVerdict(
      'Mira never considers teleporting despite being cornered.\n\nVerdict: finding'
    );
    expect(result).toEqual({
      verdict: 'finding',
      rationale: 'Mira never considers teleporting despite being cornered.'
    });
  });

  it('parses a not_a_finding verdict', () => {
    const result = parseProgressionContinuityVerdict(
      'The scenes given show no situation the ability would resolve.\n\nVerdict: not_a_finding'
    );
    expect(result?.verdict).toBe('not_a_finding');
  });

  it('returns null when no Verdict line is present', () => {
    expect(parseProgressionContinuityVerdict('Just some prose with no tag.')).toBeNull();
  });

  it('returns null for an unrecognized token', () => {
    expect(
      parseProgressionContinuityVerdict('Some rationale.\n\nVerdict: maybe')
    ).toBeNull();
  });

  it('is tolerant of trailing whitespace and case', () => {
    const result = parseProgressionContinuityVerdict('Rationale here.\n\nVerdict: FINDING  \n');
    expect(result?.verdict).toBe('finding');
  });
});
