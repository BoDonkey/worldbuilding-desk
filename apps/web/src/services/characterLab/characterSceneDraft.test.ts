import {describe, expect, it} from 'vitest';
import type {ChapterCard, WorldCanvasOpenThread} from '../../entityTypes';
import {
  buildCharacterSceneSeeds,
  formatCharacterSceneInsertHtml,
  formatCharacterSceneScratchpadHtml,
  SURPRISE_THREAD_LIMIT,
  type CharacterSceneDraft
} from './characterSceneDraft';

const card = (id: string, order: number, sceneIds: string[], overrides: Partial<ChapterCard> = {}): ChapterCard => ({
  id,
  projectId: 'p',
  title: `Card ${id}`,
  summary: `Summary ${id}`,
  status: 'planned',
  order,
  sceneIds,
  plotPoints: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const thread = (id: string, updatedAt: number, status: WorldCanvasOpenThread['status'] = 'open'): WorldCanvasOpenThread => ({
  id,
  text: `Thread ${id}`,
  status,
  createdAt: 1,
  updatedAt
});

describe('buildCharacterSceneSeeds', () => {
  it('offers linked chapter cards first, then the newest open threads only', () => {
    const seeds = buildCharacterSceneSeeds({
      sceneId: 'scene-2',
      chapterCards: [
        card('b', 2, ['scene-2'], {
          plotPoints: [
            {id: 'pp2', chapterCardId: 'b', title: 'The bargain', order: 2, createdAt: 1, updatedAt: 1},
            {id: 'pp1', chapterCardId: 'b', title: 'The arrival', order: 1, createdAt: 1, updatedAt: 1}
          ]
        }),
        card('a', 1, ['scene-2', 'scene-3'], {summary: '  '}),
        card('c', 0, ['scene-1'])
      ],
      openThreads: [
        thread('old', 1),
        thread('settled', 99, 'settled'),
        thread('aside', 98, 'set_aside'),
        thread('new', 50),
        {...thread('blank', 60), text: '   '}
      ]
    });

    expect(seeds).toEqual([
      'Chapter card "Card a"',
      'Chapter card "Card b": Summary b Plot points: The arrival; The bargain.',
      'Open thread: Thread new',
      'Open thread: Thread old'
    ]);
  });

  it('uses no chapter cards at the latest point and caps open threads', () => {
    const seeds = buildCharacterSceneSeeds({
      sceneId: null,
      chapterCards: [card('a', 1, ['scene-1'])],
      openThreads: Array.from({length: SURPRISE_THREAD_LIMIT + 3}, (_, index) => thread(`t${index}`, index))
    });

    expect(seeds).toHaveLength(SURPRISE_THREAD_LIMIT);
    expect(seeds[0]).toBe(`Open thread: Thread t${SURPRISE_THREAD_LIMIT + 2}`);
  });
});

describe('character scene formatting', () => {
  const draft: CharacterSceneDraft = {
    id: 'd',
    characterNames: ['Aria', 'Borin <Axe>'],
    positionLabel: 'the end of "Gate"',
    direction: {kind: 'surprise', seeds: ['Open thread: Who <paid> the toll?']},
    text: 'Aria: "Stay back."\n\nBorin laughs & steps closer.',
    stopped: true
  };

  it('marks Scratchpad drafts as not canon and records what the scene grew from', () => {
    expect(formatCharacterSceneScratchpadHtml(draft)).toBe(
      '<h3>Character scene: Aria, Borin &lt;Axe&gt;</h3>' +
        '<p><em>Draft from the character lab. Not canon.</em></p>' +
        '<p><em>Story state at the end of &quot;Gate&quot;</em></p>' +
        '<p><strong>Surprise me, drawn from:</strong></p><ul><li>Open thread: Who &lt;paid&gt; the toll?</li></ul>' +
        '<p>Aria: &quot;Stay back.&quot;</p><p>Borin laughs &amp; steps closer.</p>' +
        '<p><em>(Stopped before the scene finished.)</em></p>'
    );
    expect(
      formatCharacterSceneScratchpadHtml({...draft, stopped: false, direction: {kind: 'directed', setup: 'At the gate.'}})
    ).toContain('<p><strong>Setup:</strong> At the gate.</p>');
  });

  it('inserts only the escaped prose into the manuscript', () => {
    expect(formatCharacterSceneInsertHtml(draft)).toBe(
      '<p>Aria: &quot;Stay back.&quot;</p><p>Borin laughs &amp; steps closer.</p>'
    );
  });
});
