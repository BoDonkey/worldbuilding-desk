import {describe, expect, it} from 'vitest';
import {calculateContextPopoverPosition} from './contextPopoverPosition';

describe('calculateContextPopoverPosition', () => {
  it('places an anchored popover below a mention when there is room', () => {
    expect(calculateContextPopoverPosition({
      left: 200,
      top: 128,
      popoverWidth: 300,
      popoverHeight: 180,
      viewportWidth: 1000,
      viewportHeight: 800,
      anchorTop: 100,
      anchorBottom: 120
    })).toEqual({left: 200, top: 128});
  });

  it('flips above a mention near the bottom of the viewport', () => {
    expect(calculateContextPopoverPosition({
      left: 200,
      top: 748,
      popoverWidth: 300,
      popoverHeight: 180,
      viewportWidth: 1000,
      viewportHeight: 800,
      anchorTop: 720,
      anchorBottom: 740
    })).toEqual({left: 200, top: 532});
  });

  it('keeps the popover inside the horizontal viewport margin', () => {
    expect(calculateContextPopoverPosition({
      left: 950,
      top: 128,
      popoverWidth: 300,
      popoverHeight: 180,
      viewportWidth: 1000,
      viewportHeight: 800
    })).toEqual({left: 688, top: 128});
  });
});
