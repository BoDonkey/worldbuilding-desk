import {describe, expect, it} from 'vitest';
import type {CraftSearchResult} from '../craft/types';
import type {StoryDashboard} from '../dashboard/storyDashboard';
import {
  buildCraftContextChunks,
  buildCraftLibrarySearchQuery,
  buildWritingCoachPrompt,
  dedupeCraftCitations,
  summarizeStoryDashboardForCoach
} from './writingCoachConsultation';

function makeSearchResult(overrides: Partial<CraftSearchResult> = {}): CraftSearchResult {
  return {
    score: 1,
    retrievalMode: 'lexical',
    provenance: {
      role: 'craft-reference',
      label: 'Vetted craft reference',
      contentVersion: 'test-1',
      citations: [{id: 'source-1', label: 'Test craft source'}]
    },
    chunk: {
      id: 'chunk-1',
      recordId: 'craft.test.scene-goals',
      recordVersion: 1,
      title: 'Scene goals',
      section: 'What it is',
      content: 'A scene goal gives the viewpoint character something specific to pursue.',
      embedding: [],
      metadata: {
        type: 'craft',
        authorVetted: true,
        documentType: 'pattern',
        family: 'general',
        detectability: 'model-assisted',
        scopes: ['scene'],
        genres: ['general-fiction'],
        subgenres: [],
        exclusions: [],
        modifiers: [],
        tags: [],
        aliases: [],
        sourceConfidence: 'high',
        citations: [{id: 'source-1', label: 'Test craft source'}]
      }
    },
    ...overrides
  };
}

describe('buildCraftLibrarySearchQuery', () => {
  it('trims and caps the evidence text', () => {
    const query = buildCraftLibrarySearchQuery(`  ${'x'.repeat(1000)}  `);
    expect(query.length).toBe(600);
    expect(query.startsWith('x')).toBe(true);
  });
});

describe('buildWritingCoachPrompt', () => {
  it('keeps selection scope distinct from manuscript scope', () => {
    const selection = buildWritingCoachPrompt({
      scope: 'selection',
      evidenceLabel: 'Selected passage',
      evidenceText: 'She ran.'
    });
    const manuscript = buildWritingCoachPrompt({
      scope: 'manuscript',
      evidenceLabel: 'Deterministic manuscript measurements',
      evidenceText: 'Manuscript: 3 scenes.'
    });

    expect(selection.userPrompt).toContain('the selected passage below');
    expect(selection.userPrompt).toContain('She ran.');
    expect(manuscript.userPrompt).toContain('aggregate, deterministic measurements');
    expect(manuscript.userPrompt).toContain('Manuscript: 3 scenes.');
  });

  it('always states craft material is not canon and evidence-only reasoning', () => {
    const {systemPrompt} = buildWritingCoachPrompt({
      scope: 'scene',
      evidenceLabel: 'Current scene',
      evidenceText: 'Some scene text.'
    });
    expect(systemPrompt).toContain("never the author's canon");
    expect(systemPrompt).toContain('Never claim to have read or checked any other part');
  });
});

describe('buildCraftContextChunks', () => {
  it('labels every chunk as craft reference material, not canon', () => {
    const chunks = buildCraftContextChunks([makeSearchResult()]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.source).toBe('Craft reference material, not your canon - Scene goals');
    expect(chunks[0]!.content).toContain('A scene goal gives the viewpoint character');
  });
});

describe('dedupeCraftCitations', () => {
  it('deduplicates citations across multiple chunks by id', () => {
    const results = [
      makeSearchResult(),
      makeSearchResult({
        chunk: {
          ...makeSearchResult().chunk,
          id: 'chunk-2',
          metadata: {
            ...makeSearchResult().chunk.metadata,
            citations: [
              {id: 'source-1', label: 'Test craft source'},
              {id: 'source-2', label: 'Another source'}
            ]
          }
        }
      })
    ];
    const citations = dedupeCraftCitations(results);
    expect(citations).toEqual([
      {id: 'source-1', label: 'Test craft source'},
      {id: 'source-2', label: 'Another source'}
    ]);
  });
});

describe('summarizeStoryDashboardForCoach', () => {
  const baseDashboard: StoryDashboard = {
    sourceSceneIds: ['scene-1'],
    scenes: [
      {
        sceneId: 'scene-1',
        title: 'Opening',
        order: 0,
        wordCount: 500,
        quotedWordCount: 100,
        dialogueRatio: 0.2,
        acceptedChangeCount: 1
      }
    ],
    chapters: [],
    unlinkedCardCount: 0,
    totalWords: 500,
    totalQuotedWords: 100,
    dialogueRatio: 0.2,
    acceptedEventCount: 1,
    acceptedCommandCount: 1,
    missingEventSceneIds: [],
    stateDistribution: [],
    mechanics: null
  };

  it('summarizes manuscript-level totals without any raw scene prose', () => {
    const summary = summarizeStoryDashboardForCoach(baseDashboard);
    expect(summary).toContain('1 scene(s), 500 words, 20% dialogue');
    expect(summary).not.toContain('Opening');
  });

  it('includes chapters, continuity distribution, and mechanics when present', () => {
    const summary = summarizeStoryDashboardForCoach({
      ...baseDashboard,
      chapters: [
        {
          cardId: 'card-1',
          title: 'Chapter One',
          status: 'draft',
          sourceSceneIds: ['scene-1'],
          missingSceneIds: [],
          wordCount: 500,
          quotedWordCount: 100,
          dialogueRatio: 0.2,
          acceptedChangeCount: 1
        }
      ],
      stateDistribution: [
        {category: 'Attributes', commandCount: 2, eventCount: 1, sourceSceneIds: ['scene-1']}
      ],
      mechanics: {
        axes: [{axisId: 'hp', label: 'HP', kind: 'resource', commandCount: 2, sourceSceneIds: ['scene-1']}],
        coMovements: [{sceneId: 'scene-1', sceneTitle: 'Opening', axisLabels: ['HP', 'Level']}],
        advancementIntervals: [],
        advancementChangeCount: 3,
        advancementChangesPerTenThousandWords: 5.5,
        advancementSourceSceneIds: ['scene-1']
      }
    });

    expect(summary).toContain('"Chapter One" (draft): 500 words, 20% dialogue, 1 accepted change(s).');
    expect(summary).toContain('- Attributes: 2 change(s) across 1 accepted event(s).');
    expect(summary).toContain('1 tracked axis/axes changed, 3 advancement change(s), rate 5.5 / 10k words.');
    expect(summary).toContain('1 scene(s) change two or more tracked axes together.');
  });
});
