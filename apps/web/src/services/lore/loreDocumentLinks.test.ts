import {describe, expect, it} from 'vitest';
import type {LoreDocumentLink} from '../../entityTypes';
import {normalizeLoreDocumentLinks} from './loreDocumentLinks';

const link = (
  id: string,
  targetId: string,
  relationship: LoreDocumentLink['relationship']
): LoreDocumentLink => ({
  id,
  projectId: 'project-1',
  loreDocumentId: 'note-1',
  targetType: 'entity',
  targetId,
  relationship,
  createdAt: 1
});

describe('Source Note context links', () => {
  it('keeps only one primary subject and demotes later primary subjects', () => {
    expect(
      normalizeLoreDocumentLinks([
        link('one', 'record-1', 'primary_subject'),
        link('two', 'record-2', 'primary_subject'),
        link('three', 'record-3', 'mentions')
      ]).map((entry) => entry.relationship)
    ).toEqual(['primary_subject', 'secondary_subject', 'mentions']);
  });

  it('drops empty and duplicate target rows', () => {
    expect(
      normalizeLoreDocumentLinks([
        link('empty', '', 'primary_subject'),
        link('one', 'record-1', 'mentions'),
        link('duplicate', 'record-1', 'supports')
      ]).map((entry) => entry.id)
    ).toEqual(['one']);
  });
});
