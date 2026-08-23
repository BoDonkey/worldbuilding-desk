import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {LoreDocument} from '../../entityTypes';
import {extractLoreEntityProposals} from './loreEntityExtraction';

function makeDocument(content: string): LoreDocument {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Faction notes',
    kind: 'faction_notes',
    format: 'plain_text',
    content,
    source: {type: 'manual'},
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  };
}

describe('extractLoreEntityProposals', () => {
  it('keeps named clan factions without promoting sentence fragments', () => {
    const proposals = extractLoreEntityProposals({
      projectId: 'project-1',
      document: makeDocument(
        [
          'Ensure that the clan histories remain unresolved.',
          'Mira is a member of the Lantern Guild clan.'
        ].join('\n')
      ),
      links: [],
      characters: [],
      entities: []
    });

    expect(proposals.map((proposal) => proposal.name)).toEqual(['Lantern Guild Clan']);
  });

  it('finds typed entities in natural-prose dogfood faction notes', () => {
    const content = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/faction-cinder-compact.md', import.meta.url),
      'utf8'
    );
    const proposals = extractLoreEntityProposals({
      projectId: 'project-1',
      document: {...makeDocument(content), title: 'Faction Notes — The Cinder Compact'},
      links: [],
      characters: [],
      entities: []
    });

    expect(proposals.map((proposal) => proposal.name)).toEqual(
      expect.arrayContaining([
        'Cinder Compact',
        'Compact of Cinders',
        'Terrace Council',
        'Hollow Court',
        'Brannic Halloway'
      ])
    );
    expect(proposals.some((proposal) => proposal.name.includes('Chartered Delving'))).toBe(false);
  });

  it('finds the named resident in the dogfood place notes', () => {
    const content = readFileSync(
      new URL('../../../../../fixtures/trust-dogfood/lore/places-grayharbor-undervault.md', import.meta.url),
      'utf8'
    );
    const proposals = extractLoreEntityProposals({
      projectId: 'project-1',
      document: {...makeDocument(content), title: 'Place Notes — Grayharbor and the Undervault'},
      links: [],
      characters: [],
      entities: []
    });

    expect(proposals.map((proposal) => proposal.name)).toContain('Odessa Vane-Kir');
  });

  it('treats a leading article as the same entity identity', () => {
    const proposals = extractLoreEntityProposals({
      projectId: 'project-1',
      document: makeDocument('The keeper barred the Salt Door before dawn.'),
      links: [],
      characters: [],
      entities: [
        {
          id: 'salt-door',
          projectId: 'project-1',
          categoryId: 'locations',
          name: 'the Salt Door',
          fields: {},
          links: [],
          createdAt: 1,
          updatedAt: 1
        }
      ]
    });

    expect(proposals).toEqual([
      expect.objectContaining({name: 'Salt Door', targetId: 'salt-door'})
    ]);
  });
});
