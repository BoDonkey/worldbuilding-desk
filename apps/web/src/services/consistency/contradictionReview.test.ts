// @vitest-environment jsdom

import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  Character,
  WritingDocument
} from '../../entityTypes';
import {findCanonContradictions} from './contradictionReview';

const sera: Character = {
  id: 'sera',
  projectId: 'project-1',
  name: 'Sera Kestrel',
  fields: {},
  createdAt: 1,
  updatedAt: 1
};

const grayEyes: CanonicalFact = {
  id: 'fact-gray-eyes',
  projectId: 'project-1',
  targetType: 'character',
  targetId: sera.id,
  targetName: sera.name,
  sourceLoreDocumentTitle: 'Sera Kestrel dossier',
  factType: 'appearance',
  value: 'gray eyes',
  acceptedAt: 1,
  updatedAt: 1
};

const document = (content: string): WritingDocument => ({
  id: 'chapter-2',
  projectId: 'project-1',
  title: 'The Ledgerbound',
  content,
  createdAt: 1,
  updatedAt: 1
});

describe('findCanonContradictions', () => {
  it('flags the dogfood eye-color conflict against an accepted appearance fact', () => {
    const content = readFileSync(
      resolve(
        process.cwd(),
        '../../fixtures/trust-dogfood/chapters/02-the-ledgerbound.md'
      ),
      'utf8'
    );

    const items = findCanonContradictions({
      documents: [document(content)],
      entities: [],
      characters: [sera],
      canonicalFacts: [grayEyes],
      knownEntities: [
        {id: sera.id, name: sera.name, type: 'character'},
        {id: sera.id, name: 'Sera', type: 'character'}
      ]
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.issue.message).toContain('green');
    expect(items[0]?.issue.message).toContain('gray eyes');
    expect(items[0]?.issue.surface).toBeUndefined();
    expect(items[0]?.issue.focusText).toContain('same green');
    expect(items[0]?.issue.relatedEntities?.[0]?.name).toBe('Sera Kestrel');
  });

  it('does not flag an eye-color statement that agrees with accepted canon', () => {
    const items = findCanonContradictions({
      documents: [document('Sera Kestrel smiled. Her gray eyes caught the light.')],
      entities: [],
      characters: [sera],
      canonicalFacts: [grayEyes],
      knownEntities: [{id: sera.id, name: sera.name, type: 'character'}]
    });

    expect(items).toEqual([]);
  });

  it('does not attribute another character\'s eye color to the canon target', () => {
    const items = findCanonContradictions({
      documents: [
        document(
          '<p>Sera Kestrel crossed the room beside Tam.</p>' +
          '<p>Tam\'s green eyes caught the light.</p>'
        )
      ],
      entities: [],
      characters: [sera],
      canonicalFacts: [grayEyes],
      knownEntities: [{id: sera.id, name: sera.name, type: 'character'}]
    });

    expect(items).toEqual([]);
  });

  it('uses the same conflict contract for non-appearance assertions', () => {
    const readyFact: CanonicalFact = {
      ...grayEyes,
      id: 'fact-ready',
      factType: 'trait',
      value: 'ready'
    };
    const items = findCanonContradictions({
      documents: [document('Sera Kestrel is not ready.')],
      entities: [],
      characters: [sera],
      canonicalFacts: [readyFact],
      knownEntities: [{id: sera.id, name: sera.name, type: 'character'}]
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.issue).toMatchObject({
      code: 'STATE_CONFLICT',
      focusText: 'Sera Kestrel is not ready'
    });
    expect(items[0]?.issue.surface).toBeUndefined();
  });
});
