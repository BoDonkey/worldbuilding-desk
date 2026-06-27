import {describe, expect, it} from 'vitest';
import {buildWorkspaceAnnotationDecorationSpecs} from './WorkspaceAnnotationsExtension';

describe('buildWorkspaceAnnotationDecorationSpecs', () => {
  it('renders known canon instead of an overlapping shorter review candidate', () => {
    const specs = buildWorkspaceAnnotationDecorationSpecs({
      text: 'Detective Garcia deTerra entered. Garcia waited.',
      knownSurfaces: [
        {
          id: 'garcia-canon',
          surface: 'Garcia deTerra',
          type: 'character'
        }
      ],
      reviewSurfaces: [
        {
          id: 'unknown-garcia',
          surface: 'Garcia',
          message: 'Unknown name.',
          severity: 'warning'
        }
      ]
    });

    expect(
      specs.map((spec) => ({
        text: 'Detective Garcia deTerra entered. Garcia waited.'.slice(
          spec.from,
          spec.to
        ),
        className: spec.attrs.class,
        loreId: spec.attrs['data-lore-id'],
        reviewId: spec.attrs['data-consistency-id']
      }))
    ).toEqual([
      {
        text: 'Detective Garcia deTerra',
        className: 'lore-highlight',
        loreId: 'garcia-canon',
        reviewId: undefined
      },
      {
        text: 'Garcia',
        className: 'consistency-highlight consistency-highlight-warning',
        loreId: undefined,
        reviewId: 'unknown-garcia'
      }
    ]);
  });

  it('keeps passive review candidates out of inline decorations', () => {
    const specs = buildWorkspaceAnnotationDecorationSpecs({
      text: 'Garcia waited.',
      knownSurfaces: [],
      reviewSurfaces: [
        {
          id: 'unknown-garcia',
          surface: 'Garcia',
          message: 'Review later.',
          severity: 'warning',
          issueCode: 'UNKNOWN_ENTITY',
          inlineMode: 'passive'
        }
      ]
    });

    expect(specs).toEqual([]);
  });

  it('emits non-overlapping lore and review decorations from one decision pass', () => {
    const specs = buildWorkspaceAnnotationDecorationSpecs({
      text: "Garcia deTerra's badge flashed near the Ember Archive.",
      knownSurfaces: [
        {
          id: 'garcia-canon',
          surface: 'Garcia deTerra',
          type: 'character'
        },
        {
          id: 'ember-archive',
          surface: 'Ember Archive',
          type: 'entity'
        }
      ],
      reviewSurfaces: [
        {
          id: 'unknown-garcia',
          surface: 'Garcia',
          message: 'Unknown name.',
          severity: 'warning'
        },
        {
          id: 'unknown-badge',
          surface: 'badge',
          message: 'Unknown item.',
          severity: 'blocking',
          inlineMode: 'visible'
        }
      ]
    });

    const ranges = specs.map((spec) => ({from: spec.from, to: spec.to}));
    const overlaps = ranges.some((range, index) =>
      ranges.some(
        (other, otherIndex) =>
          index !== otherIndex && range.from < other.to && range.to > other.from
      )
    );

    expect(overlaps).toBe(false);
    expect(
      specs.map((spec) => ({
        text: "Garcia deTerra's badge flashed near the Ember Archive.".slice(
          spec.from,
          spec.to
        ),
        className: spec.attrs.class
      }))
    ).toEqual([
      {
        text: "Garcia deTerra's",
        className: 'lore-highlight'
      },
      {
        text: 'badge',
        className: 'consistency-highlight consistency-highlight-blocking'
      },
      {
        text: 'Ember Archive',
        className: 'lore-highlight'
      }
    ]);
  });
});
