import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {getWorldCanvasByProjectId, saveWorldCanvas} from './worldCanvasStorage';
import {
  collapseLens,
  createEmptyWorldCanvas,
  linkLensEntity,
  linkLensSourceNote,
  openLens,
  updateLensNote
} from './services/worldBible/worldCanvasService';

describe('worldCanvasStorage', () => {
  it('round-trips the project singleton through its projectId index', async () => {
    const projectId = `canvas-storage-${crypto.randomUUID()}`;
    const canvas = {
      ...collapseLens(
        linkLensEntity(
          linkLensSourceNote(
            updateLensNote(openLens(createEmptyWorldCanvas(projectId), 'places'), 'places', 'The crater sings at dawn.'),
            'places',
            'note-1'
          ),
          'places',
          'entity-1'
        ),
        'places'
      ),
      premise: 'A city survives inside a glass crater.'
    };

    await saveWorldCanvas(canvas);

    await expect(getWorldCanvasByProjectId(projectId)).resolves.toEqual(canvas);
    expect((await getWorldCanvasByProjectId(projectId))?.lenses[0]).toMatchObject({
      note: 'The crater sings at dawn.',
      linkedSourceNoteIds: ['note-1'],
      linkedEntityIds: ['entity-1'],
      isCollapsed: true
    });
    await expect(getWorldCanvasByProjectId(`${projectId}-missing`)).resolves.toBeNull();
  });
});
