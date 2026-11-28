import {describe, expect, it} from 'vitest';
import {entityImageFileProblem, thumbnailSize, totalImageBytes} from './entityImages';
import {formatImageBytes} from '../../utils/imageFiles';

describe('entity images (4.100)', () => {
  it('accepts common image types with no size limit', () => {
    expect(entityImageFileProblem({type: 'image/png', name: 'mira.png'})).toBeNull();
    expect(entityImageFileProblem({type: 'image/gif', name: 'mira.gif'})).toBeNull();
    expect(entityImageFileProblem({type: 'image/svg+xml', name: 'mira.svg'})).toBe(
      'mira.svg is not a PNG, JPEG, WebP, or GIF image.'
    );
  });

  it('shrinks thumbnails to fit 160 px, keeps the shape, and never enlarges', () => {
    expect(thumbnailSize(3200, 1600)).toEqual({width: 160, height: 80});
    expect(thumbnailSize(900, 1800)).toEqual({width: 80, height: 160});
    expect(thumbnailSize(64, 40)).toEqual({width: 64, height: 40});
    expect(thumbnailSize(10000, 1)).toEqual({width: 160, height: 1});
  });

  it('adds up sizes and formats them for display', () => {
    expect(totalImageBytes([{byteLength: 1024 * 1024}, {byteLength: 512 * 1024}])).toBe(1536 * 1024);
    expect(formatImageBytes(1536 * 1024)).toBe('1.5 MB');
    expect(formatImageBytes(300 * 1024)).toBe('300 KB');
    expect(formatImageBytes(10)).toBe('1 KB');
  });
});
