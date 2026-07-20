import {describe, expect, it} from 'vitest';
import type {WritingDocument} from './entityTypes';
import {
  getNextWritingDocumentOrder,
  sortWritingDocuments
} from './writingStorage';

const makeDocument = (
  id: string,
  overrides: Partial<WritingDocument> = {}
): WritingDocument => ({
  id,
  projectId: 'project-a',
  title: `Scene ${id}`,
  content: '<p>Draft</p>',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('sortWritingDocuments', () => {
  it('uses explicit scene order before legacy timestamps', () => {
    const documents = [
      makeDocument('chapter-three', {title: 'Chapter Three', order: 2, createdAt: 1}),
      makeDocument('chapter-one', {title: 'Chapter One', order: 0, createdAt: 3}),
      makeDocument('chapter-two', {title: 'Chapter Two', order: 1, createdAt: 2})
    ];

    expect(sortWritingDocuments(documents).map((doc) => doc.title)).toEqual([
      'Chapter One',
      'Chapter Two',
      'Chapter Three'
    ]);
  });

  it('falls back to creation time and natural title order for legacy records', () => {
    const documents = [
      makeDocument('chapter-three', {title: 'Chapter 3', createdAt: 10}),
      makeDocument('chapter-two', {title: 'Chapter 2', createdAt: 10}),
      makeDocument('chapter-one', {title: 'Chapter 1', createdAt: 10}),
      makeDocument('chapter-four', {title: 'Chapter 4', createdAt: 20})
    ];

    expect(sortWritingDocuments(documents).map((doc) => doc.title)).toEqual([
      'Chapter 1',
      'Chapter 2',
      'Chapter 3',
      'Chapter 4'
    ]);
  });

  it('keeps mixed explicit and legacy records in legacy chronology', () => {
    const documents = [
      makeDocument('legacy', {title: 'Legacy scene', createdAt: 1}),
      makeDocument('ordered', {title: 'Ordered scene', order: 0, createdAt: 2})
    ];

    expect(sortWritingDocuments(documents).map((doc) => doc.id)).toEqual([
      'legacy',
      'ordered'
    ]);
  });
});

describe('getNextWritingDocumentOrder', () => {
  it('appends after the highest explicit order', () => {
    expect(
      getNextWritingDocumentOrder([
        makeDocument('one', {order: 0}),
        makeDocument('three', {order: 2})
      ])
    ).toBe(3);
  });

  it('uses the current document count for legacy-only projects', () => {
    expect(getNextWritingDocumentOrder([makeDocument('one'), makeDocument('two')])).toBe(2);
  });
});
