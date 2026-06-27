import {describe, expect, it} from 'vitest';
import type {GuardrailIssue} from '../services/consistency/types';
import type {ReviewIssueAnnotation} from '../services/worldEngine';
import {mapReviewAnnotationsByIssueKey} from './useWorkspaceConsistency';

const makeUnknownIssue = (surface: string): GuardrailIssue => ({
  code: 'UNKNOWN_ENTITY',
  severity: 'blocking',
  message: `Entity '${surface}' not found. Create it before saving.`,
  surface
});

const makeAnnotation = (summary: string): ReviewIssueAnnotation => ({
  issueCode: 'UNKNOWN_ENTITY',
  summary,
  confidence: 0.9,
  evidence: {text: summary, start: 0, end: summary.length},
  source: 'deterministic',
  engineLabel: 'Deterministic review'
});

describe('mapReviewAnnotationsByIssueKey', () => {
  it('keeps annotations paired with their issue after earlier issues are filtered', () => {
    const issues = [
      makeUnknownIssue('Shangri-La Advanced Research Institute'),
      makeUnknownIssue('Harrison')
    ];
    const annotations = [
      makeAnnotation('Entity Shangri-La Advanced Research Institute not found.'),
      makeAnnotation('Entity Harrison not found.')
    ];

    const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(issues, annotations);
    const filteredIssue = issues[1];

    expect(
      filteredIssue ? annotationsByIssueKey.get('UNKNOWN_ENTITY:harrison')?.summary : null
    ).toBe('Entity Harrison not found.');
  });
});
