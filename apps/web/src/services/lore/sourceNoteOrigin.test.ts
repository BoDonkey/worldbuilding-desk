import {describe, expect, it} from 'vitest';
import type {LoreDocument, LoreDocumentLink} from '../../entityTypes';
import {extractLoreEntityProposals} from './loreEntityExtraction';
import {extractLoreFactProposals} from './loreFactExtraction';
import {
  SUGGESTED_DETAILS_HEADING,
  describeSourceNoteForPrompt,
  findSuggestedDetailsStart,
  hasSuggestedDetails,
  isAiSessionSourceNote,
  withoutSuggestedDetails
} from './sourceNoteOrigin';

const AUTHOR_TEXT = 'Occupation: ferry pilot\nShe grew up on the river.';
const SUGGESTED = [
  SUGGESTED_DETAILS_HEADING,
  '- Age: 41',
  '- She is a member of the Tallow Guild',
  '- Her eyes are green,\nand she was partnered with Oren Pike'
].join('\n');

function makeNote(content: string, source: LoreDocument['source'] = {type: 'ai-session', sessionId: 's'}): LoreDocument {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Character lab: Wren Calloway',
    kind: 'character_dossier',
    format: 'plain_text',
    content,
    source,
    status: 'active',
    createdAt: 1,
    updatedAt: 1
  };
}

const links: LoreDocumentLink[] = [
  {
    id: 'link-1',
    projectId: 'project-1',
    loreDocumentId: 'doc-1',
    targetType: 'entity',
    targetId: 'entity-1',
    relationship: 'primary_subject',
    createdAt: 1
  }
];

const extractFacts = (document: LoreDocument) =>
  extractLoreFactProposals({
    projectId: 'project-1',
    document,
    links,
    knownTargets: [{type: 'entity', id: 'entity-1', name: 'Wren Calloway'}],
    existingFacts: []
  });

const extractEntities = (document: LoreDocument) =>
  extractLoreEntityProposals({projectId: 'project-1', document, links, characters: [], entities: []});

describe('Source Note origin', () => {
  it('tells a note saved from an AI session from one the author typed or imported', () => {
    expect(isAiSessionSourceNote(makeNote('x'))).toBe(true);
    expect(isAiSessionSourceNote(makeNote('x', {type: 'manual'}))).toBe(false);
    expect(isAiSessionSourceNote(makeNote('x', {type: 'import', fileName: 'a.md'}))).toBe(false);
  });

  it('names an AI-session note as such in a prompt and leaves other titles alone', () => {
    expect(describeSourceNoteForPrompt(makeNote('x'))).toBe(
      'Character lab: Wren Calloway (saved from an AI session, may be model-written)'
    );
    expect(describeSourceNoteForPrompt(makeNote('x', {type: 'manual'}))).toBe('Character lab: Wren Calloway');
  });

  it('finds the suggested-details heading, also after the note became Markdown', () => {
    const content = `${AUTHOR_TEXT}\n\n${SUGGESTED}`;
    expect(findSuggestedDetailsStart(content)).toBe(AUTHOR_TEXT.length + 2);
    expect(findSuggestedDetailsStart(`${AUTHOR_TEXT}\n\n  ${SUGGESTED_DETAILS_HEADING}  \n\\- Age: 41`)).toBe(
      AUTHOR_TEXT.length + 2
    );
    expect(hasSuggestedDetails(AUTHOR_TEXT)).toBe(false);
    // The heading must stand on its own line; a sentence quoting it does not open a block.
    expect(hasSuggestedDetails(`I renamed "${SUGGESTED_DETAILS_HEADING}" yesterday.`)).toBe(false);
  });

  it('blanks the block without moving any other text', () => {
    const note = makeNote(`${AUTHOR_TEXT}\n\n${SUGGESTED}`);
    const masked = withoutSuggestedDetails(note);
    expect(masked.content).toHaveLength(note.content.length);
    expect(masked.content.startsWith(`${AUTHOR_TEXT}\n\n`)).toBe(true);
    expect(masked.content.slice(AUTHOR_TEXT.length).trim()).toBe('');
    expect(masked.content.split('\n')).toHaveLength(note.content.split('\n').length);
    const plain = makeNote(AUTHOR_TEXT);
    expect(withoutSuggestedDetails(plain)).toBe(plain);
  });
});

describe('extraction and the suggested-details block', () => {
  it('proposes facts only from the text above the block', () => {
    const proposals = extractFacts(makeNote(`${AUTHOR_TEXT}\n\n${SUGGESTED}`));
    expect(proposals.map((proposal) => [proposal.factType, proposal.value])).toEqual([
      ['occupation', 'ferry pilot']
    ]);
    // The offset still points into the stored text: the block was blanked, not cut.
    expect(AUTHOR_TEXT.slice(proposals[0].evidence.start).startsWith('ferry pilot')).toBe(true);
  });

  it('proposes no records from names that appear only in the block', () => {
    const proposals = extractEntities(
      makeNote(`She is a member of the Lantern Guild clan.\n\n${SUGGESTED}\n- Sworn to the Hollow Court`)
    );
    expect(proposals.map((proposal) => proposal.name)).toEqual(['Lantern Guild Clan']);
  });

  it('skips the block in any note that carries the heading, whatever its source', () => {
    expect(extractFacts(makeNote(`${AUTHOR_TEXT}\n\n${SUGGESTED}`, {type: 'manual'}))).toHaveLength(1);
  });

  it('still reads a suggestion the author moved above the heading', () => {
    const proposals = extractFacts(makeNote(`${AUTHOR_TEXT}\n- Age: 41\n\n${SUGGESTED_DETAILS_HEADING}\n- Hums`));
    expect(proposals.map((proposal) => proposal.factType)).toEqual(['occupation', 'age']);
  });
});
