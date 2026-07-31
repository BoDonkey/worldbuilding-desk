import {describe, expect, it} from 'vitest';
import type {GuardrailIssue} from './types';
import type {ReviewIssueAnnotation} from '../worldEngine';
import {
  buildHighlightableUnknownIssues,
  buildReviewReadiness,
  filterUnknownGuardrailIssues,
  mapReviewAnnotationsByIssueKey
} from './reviewReadiness';

const issue = (
  surface: string,
  severity: GuardrailIssue['severity'] = 'blocking'
): GuardrailIssue => ({
  code: 'UNKNOWN_ENTITY',
  severity,
  message: `${surface} is unknown`,
  surface
});

const annotation: ReviewIssueAnnotation = {
  issueCode: 'UNKNOWN_ENTITY',
  summary: 'AI review',
  confidence: 0.8,
  evidence: {text: 'Harrison', start: 0, end: 8},
  source: 'local-ai',
  engineLabel: 'Local AI'
};

const emptySummary = {
  totalCount: 0,
  inlineVisibleCount: 0,
  passiveCount: 0,
  suppressedCount: 0,
  blockingCount: 0
};

describe('review issue modeling', () => {
  it('maps annotations to stable normalized issue keys', () => {
    expect(
      mapReviewAnnotationsByIssueKey([issue('Harrison')], [annotation]).get(
        'UNKNOWN_ENTITY:harrison'
      )
    ).toBe(annotation);
  });

  it('removes known and duplicate unknown surfaces', () => {
    expect(
      filterUnknownGuardrailIssues({
        issues: [issue('Known'), issue('Harrison'), issue('harrison')],
        knownSurfaceSet: new Set(['known'])
      }).map((entry) => entry.surface)
    ).toEqual(['Harrison']);
  });

  it('deduplicates active-scene highlights and preserves annotation source', () => {
    const unknown = issue('Harrison', 'warning');
    const highlights = buildHighlightableUnknownIssues({
      unknownGuardrailIssues: [unknown],
      consistencyReviewItems: [
        {
          id: 'review-1',
          sceneId: 'scene-1',
          sceneTitle: 'Scene',
          issue: unknown,
          reviewAnnotation: annotation
        }
      ],
      selectedDocumentId: 'scene-1',
      knownSurfaceSet: new Set()
    });

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({surface: 'Harrison', inlineMode: 'passive'});
  });
});

describe('buildReviewReadiness', () => {
  it('prioritizes unavailable, running, and blocking states', () => {
    const base = {
      annotationSummary: emptySummary,
      stateMutationEvents: [],
      isRunningConsistencyReview: false,
      hasBlockingUnknownGuardrailIssues: false
    };
    expect(
      buildReviewReadiness({
        ...base,
        worldEngineStatus: {state: 'notInstalled'}
      }).state
    ).toBe('unavailable');
    expect(
      buildReviewReadiness({
        ...base,
        worldEngineStatus: null,
        isRunningConsistencyReview: true
      }).state
    ).toBe('running');
    expect(
      buildReviewReadiness({
        ...base,
        worldEngineStatus: null,
        hasBlockingUnknownGuardrailIssues: true
      }).state
    ).toBe('attention');
  });

  it('counts active mutation suggestions and passive review separately', () => {
    const readiness = buildReviewReadiness({
      annotationSummary: {...emptySummary, passiveCount: 2, totalCount: 2},
      stateMutationEvents: [
        {
          id: 'event', projectId: 'project', sceneId: 'scene', sourceRevision: 1,
          sourceHash: 'hash', status: 'proposed', sourceType: 'deterministic-review',
          commands: [], createdAt: 1
        }
      ],
      worldEngineStatus: {state: 'available', modelLabel: 'Deterministic'},
      isRunningConsistencyReview: false,
      hasBlockingUnknownGuardrailIssues: false
    });
    expect(readiness).toMatchObject({
      state: 'ready', count: 3, activeCount: 1, passiveCount: 2,
      label: '1 active, 2 later'
    });
  });

  it('returns idle when no review work is open', () => {
    expect(
      buildReviewReadiness({
        annotationSummary: emptySummary,
        stateMutationEvents: [],
        worldEngineStatus: null,
        isRunningConsistencyReview: false,
        hasBlockingUnknownGuardrailIssues: false
      }).state
    ).toBe('idle');
  });
});
