import {describe, expect, it} from 'vitest';
import {
  buildWorkspaceAnnotations,
  getVisibleWorkspaceAnnotations,
  summarizeWorkspaceReviewSurfaces
} from './workspaceAnnotations';

describe('workspaceAnnotations', () => {
  it('treats known canon and unresolved review as one annotation decision set', () => {
    const annotations = getVisibleWorkspaceAnnotations({
      text: 'Garcia deTerra opened the case. Garcia waited.',
      knownSurfaces: [
        {
          id: 'garcia',
          surface: 'Garcia deTerra',
          metadata: {type: 'entity'}
        }
      ],
      reviewSurfaces: [
        {
          id: 'unknown-garcia',
          surface: 'Garcia',
          message: 'Unknown name.',
          severity: 'warning',
          metadata: {surface: 'Garcia'}
        }
      ]
    });

    expect(
      annotations.map((annotation) => [annotation.kind, annotation.surface])
    ).toEqual([
      ['known-canon', 'Garcia deTerra'],
      ['review-candidate', 'Garcia']
    ]);
  });

  it('extends exact known names through titles without promoting titles to canon', () => {
    const annotations = buildWorkspaceAnnotations({
      text: 'Detective Garcia deTerra entered.',
      knownSurfaces: [
        {
          id: 'garcia',
          surface: 'Garcia deTerra',
          metadata: {type: 'entity'}
        }
      ],
      reviewSurfaces: [
        {
          id: 'unknown-detective-garcia',
          surface: 'Detective Garcia deTerra',
          message: 'Unknown name.',
          severity: 'warning',
          metadata: {surface: 'Detective Garcia deTerra'}
        }
      ]
    });

    expect(
      annotations.map((annotation) => [
        annotation.kind,
        annotation.surface,
        annotation.visibility
      ])
    ).toEqual([
      ['known-canon', 'Detective Garcia deTerra', 'visible'],
      ['review-candidate', 'Detective Garcia deTerra', 'suppressed']
    ]);
  });

  it('does not invent unknown annotations from ordinary capitalized prose', () => {
    const annotations = getVisibleWorkspaceAnnotations({
      text: 'Traffic opened around the station.',
      knownSurfaces: [],
      reviewSurfaces: []
    });

    expect(annotations).toEqual([]);
  });

  it('preserves review annotations that the review pipeline explicitly hands it', () => {
    const annotations = getVisibleWorkspaceAnnotations({
      text: 'Traffic circled the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-traffic',
          surface: 'Traffic',
          message: 'Unknown name.',
          severity: 'warning',
          metadata: {surface: 'Traffic'}
        }
      ]
    });

    expect(
      annotations.map((annotation) => [annotation.kind, annotation.surface])
    ).toEqual([['review-candidate', 'Traffic']]);
  });

  it('carries review provenance and confidence into annotation decisions', () => {
    const annotations = getVisibleWorkspaceAnnotations({
      text: 'Traffic circled the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-traffic',
          surface: 'Traffic',
          message: 'Unknown name.',
          severity: 'warning',
          source: 'local-ai-review',
          confidence: 0.63,
          metadata: {surface: 'Traffic'}
        }
      ]
    });

    expect(annotations[0]).toMatchObject({
      kind: 'review-candidate',
      source: 'local-ai-review',
      confidence: 0.63
    });
  });

  it('keeps passive review candidates available without making them inline-visible', () => {
    const annotations = buildWorkspaceAnnotations({
      text: 'Traffic circled the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-traffic',
          surface: 'Traffic',
          message: 'Unknown name.',
          severity: 'warning',
          issueCode: 'UNKNOWN_ENTITY',
          inlineMode: 'passive',
          confidence: 0.63,
          metadata: {surface: 'Traffic'}
        }
      ]
    });

    expect(annotations[0]).toMatchObject({
      kind: 'review-candidate',
      surface: 'Traffic',
      visibility: 'suppressed',
      inlineMode: 'passive'
    });
    expect(getVisibleWorkspaceAnnotations({
      text: 'Traffic circled the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-traffic',
          surface: 'Traffic',
          message: 'Unknown name.',
          severity: 'warning',
          issueCode: 'UNKNOWN_ENTITY',
          inlineMode: 'passive'
        }
      ]
    })).toEqual([]);
  });

  it('keeps blocking unknowns and ambiguous references inline-visible', () => {
    const annotations = getVisibleWorkspaceAnnotations({
      text: 'Traffic met River at the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-traffic',
          surface: 'Traffic',
          message: 'Unknown name.',
          severity: 'blocking',
          issueCode: 'UNKNOWN_ENTITY',
          inlineMode: 'visible'
        },
        {
          id: 'ambiguous-river',
          surface: 'River',
          message: 'Reference matches multiple records.',
          severity: 'warning',
          issueCode: 'AMBIGUOUS_REFERENCE'
        }
      ]
    });

    expect(
      annotations.map((annotation) => [
        annotation.issueCode,
        annotation.surface,
        annotation.visibility
      ])
    ).toEqual([
      ['UNKNOWN_ENTITY', 'Traffic', 'visible'],
      ['AMBIGUOUS_REFERENCE', 'River', 'visible']
    ]);
  });

  it('represents ignored and project-suppressed surfaces as suppressed annotations', () => {
    const annotations = buildWorkspaceAnnotations({
      text: 'Traffic circled the station.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'ignored-traffic',
          surface: 'Traffic',
          message: 'Ignored name.',
          severity: 'warning',
          source: 'project-suppressed',
          issueCode: 'UNKNOWN_ENTITY'
        }
      ]
    });

    expect(annotations[0]).toMatchObject({
      source: 'project-suppressed',
      visibility: 'suppressed'
    });
  });

  it('summarizes active, passive, and suppressed review surfaces separately', () => {
    const summary = summarizeWorkspaceReviewSurfaces([
      {
        id: 'unknown-garcia',
        surface: 'Garcia',
        message: 'Unknown name.',
        severity: 'blocking',
        issueCode: 'UNKNOWN_ENTITY',
        inlineMode: 'visible'
      },
      {
        id: 'unknown-traffic',
        surface: 'Traffic',
        message: 'Unknown name.',
        severity: 'warning',
        issueCode: 'UNKNOWN_ENTITY',
        inlineMode: 'passive'
      },
      {
        id: 'ignored-open',
        surface: 'open',
        message: 'Ignored term.',
        severity: 'warning',
        issueCode: 'UNKNOWN_ENTITY',
        source: 'project-suppressed'
      }
    ]);

    expect(summary).toEqual({
      totalCount: 3,
      inlineVisibleCount: 1,
      passiveCount: 1,
      suppressedCount: 2,
      blockingCount: 1
    });
  });

  it('keeps possessive known canon visible ahead of shorter review candidates', () => {
    const annotations = buildWorkspaceAnnotations({
      text: "Garcia deTerra's badge flashed.",
      knownSurfaces: [
        {
          id: 'garcia',
          surface: 'Garcia deTerra',
          metadata: {type: 'entity'}
        }
      ],
      reviewSurfaces: [
        {
          id: 'unknown-garcia',
          surface: 'Garcia',
          message: 'Unknown name.',
          severity: 'warning',
          metadata: {surface: 'Garcia'}
        }
      ]
    });

    expect(
      annotations.map((annotation) => [
        annotation.kind,
        annotation.surface,
        annotation.visibility
      ])
    ).toEqual([
      ['known-canon', "Garcia deTerra's", 'visible'],
      ['review-candidate', 'Garcia', 'suppressed']
    ]);
  });
});
