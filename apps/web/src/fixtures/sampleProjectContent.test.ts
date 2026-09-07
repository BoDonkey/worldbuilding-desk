import {describe, expect, it} from 'vitest';
import {SAMPLE_CHAPTERS, SAMPLE_LORE_DOCUMENTS, SAMPLE_PROJECT_NAME} from './sampleProjectContent';

describe('sampleProjectContent', () => {
  it('has a non-empty project name', () => {
    expect(SAMPLE_PROJECT_NAME.trim().length).toBeGreaterThan(0);
  });

  it('has two ordered chapters with non-empty content', () => {
    expect(SAMPLE_CHAPTERS).toHaveLength(2);
    for (const chapter of SAMPLE_CHAPTERS) {
      expect(chapter.title.trim().length).toBeGreaterThan(0);
      expect(chapter.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('has three lore documents', () => {
    expect(SAMPLE_LORE_DOCUMENTS).toHaveLength(3);
  });

  it('sets up the deliberate Brannic service-length contradiction between two lore documents', () => {
    const factionNotes = SAMPLE_LORE_DOCUMENTS.find((doc) => doc.title.includes('Faction Notes'));
    const workingNotes = SAMPLE_LORE_DOCUMENTS.find((doc) => doc.title.includes('Working Notes'));
    expect(factionNotes?.content).toMatch(/twenty years/i);
    expect(workingNotes?.content).toMatch(/a decade/i);
  });

  it('does not carry the fixture\'s unrelated "DO NOT seed" plant into the shipped sample', () => {
    for (const doc of SAMPLE_LORE_DOCUMENTS) {
      expect(doc.content).not.toMatch(/hollow court/i);
      expect(doc.content).not.toMatch(/do not seed/i);
    }
  });
});
