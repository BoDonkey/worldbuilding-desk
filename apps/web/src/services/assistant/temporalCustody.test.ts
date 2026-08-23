import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {WritingDocument} from '../../entityTypes';
import {resolveTemporalCustodyAnswer} from './temporalCustody';

const scene = (order: number, title: string, content: string): WritingDocument => ({
  id: `scene-${order}`,
  projectId: 'project',
  title,
  content,
  order,
  createdAt: order,
  updatedAt: order
});

describe('temporal custody grounding', () => {
  it('reports the complete D4 custody conflict from the five-chapter fixture', () => {
    const files = [
      '01-the-salt-door.md',
      '02-the-ledgerbound.md',
      '03-the-weighing-house.md',
      '04-sorrowsteel.md',
      '05-the-hollow-court.md'
    ];
    const scenes = files.map((fileName, index) => {
      const content = readFileSync(
        new URL(
          `../../../../../fixtures/trust-dogfood/chapters/${fileName}`,
          import.meta.url
        ),
        'utf8'
      );
      return scene(
        index + 1,
        content.split('\n')[0]?.replace(/^# /, '') ?? fileName,
        content
      );
    });

    const answer = resolveTemporalCustodyAnswer(
      'Where is the Emberglass Key kept?',
      scenes,
      []
    );

    expect(answer?.content).toBe(
      "The designated storage for the Emberglass Key is Odessa's deep vault, but later saved scenes do not support saying it is currently there. Chapter Four — Sorrowsteel says it was signed out; Chapter Four — Sorrowsteel says Brannic has it in a pocket; Chapter Five — The Hollow Court says Sera uses it. No transfer between those holders is established. Current custody is uncertain."
    );
    expect(answer?.results.map((result) => result.chunk.documentTitle)).toEqual([
      'Chapter Three — The Weighing House',
      'Chapter Four — Sorrowsteel',
      'Chapter Five — The Hollow Court'
    ]);
  });

  it('distinguishes designated storage from later incompatible custody', () => {
    const answer = resolveTemporalCustodyAnswer(
      'Where is the Emberglass Key kept?',
      [
        scene(
          3,
          'Chapter Three — The Weighing House',
          'Odessa tapped the desk. "The Key goes into my deep vault."'
        ),
        scene(
          4,
          'Chapter Four — Sorrowsteel',
          "Signed out of Odessa's deep vault that morning, the Key had gone back into Brannic's breast pocket after."
        ),
        scene(
          5,
          'Chapter Five — The Hollow Court',
          'Sera came down the antechamber slowly.\n\nShe stopped at the gate. She pressed the Emberglass Key into the lock.'
        )
      ],
      []
    );

    expect(answer?.content).toContain(
      "The designated storage for the Emberglass Key is Odessa's deep vault"
    );
    expect(answer?.content).toContain('Chapter Four — Sorrowsteel says it was signed out');
    expect(answer?.content).toContain('Brannic has it in a pocket');
    expect(answer?.content).toContain('Chapter Five — The Hollow Court says Sera uses it');
    expect(answer?.content).toContain('No transfer between those holders is established');
    expect(answer?.content).toContain('Current custody is uncertain');
    expect(answer?.results.map((result) => result.chunk.documentTitle)).toEqual([
      'Chapter Three — The Weighing House',
      'Chapter Four — Sorrowsteel',
      'Chapter Five — The Hollow Court'
    ]);
  });

  it('reports a later sign-out even when retrieval contains only the storage scene', () => {
    const answer = resolveTemporalCustodyAnswer(
      'Where is the Emberglass Key stored?',
      [
        scene(3, 'Chapter Three', 'The Key goes into my deep vault.'),
        scene(
          4,
          'Chapter Four',
          "Signed out of Odessa's deep vault, the Key went into Brannic's pocket."
        )
      ],
      [
        {
          score: 3,
          chunk: {
            id: 'ranked-storage',
            documentId: 'scene-3',
            documentTitle: 'Chapter Three',
            content: 'The Key goes into my deep vault.',
            metadata: {type: 'scene'}
          }
        }
      ]
    );

    expect(answer?.content).toContain('later saved scenes do not support saying it is currently there');
    expect(answer?.content).toContain('Current custody is uncertain');
    expect(answer?.results.map((result) => result.chunk.documentId)).toEqual([
      'scene-3',
      'scene-4'
    ]);
  });

  it('uses accepted canon as a fallback only when saved scenes have no custody evidence', () => {
    const answer = resolveTemporalCustodyAnswer(
      'Where is the Emberglass Key kept?',
      [],
      [
        {
          score: 2,
          chunk: {
            id: 'key-canon',
            documentId: 'key',
            documentTitle: 'Emberglass Key',
            content: "The Emberglass Key is stored in Odessa's vault.",
            metadata: {type: 'worldbible'}
          }
        }
      ]
    );

    expect(answer?.content).toBe(
      "The Emberglass Key is designated to be kept in Odessa's vault."
    );
    expect(answer?.results[0]?.chunk.metadata.type).toBe('worldbible');
  });

  it('fails closed on incompatible accepted storage records', () => {
    const answer = resolveTemporalCustodyAnswer(
      'Where is the Emberglass Key secured?',
      [],
      ['vault', 'armory'].map((location, index) => ({
        score: 2 - index,
        chunk: {
          id: `location-${index}`,
          documentId: `canon-${index}`,
          documentTitle: 'Emberglass Key',
          content: `The Emberglass Key is stored in the ${location}.`,
          metadata: {type: 'canon_fact' as const}
        }
      }))
    );

    expect(answer?.content).toContain('conflicting storage locations');
    expect(answer?.content).toContain("won't choose one");
    expect(answer?.results).toHaveLength(2);
  });
});
