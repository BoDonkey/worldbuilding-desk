import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {getWorldCanvasByProjectId, saveWorldCanvas} from './worldCanvasStorage';
import {
  collapseLens,
  createEmptyWorldCanvas,
  getActiveSketch,
  linkSketchEntity,
  linkSketchSourceNote,
  openLens,
  updateSketchText
} from './services/worldBible/worldCanvasService';

describe('worldCanvasStorage', () => {
  it('round-trips the project singleton through its projectId index', async () => {
    const projectId = `canvas-storage-${crypto.randomUUID()}`;
    let canvas = openLens(createEmptyWorldCanvas(projectId), 'places');
    const sketchId = getActiveSketch(canvas.lenses[0]).id;
    canvas = updateSketchText(canvas, 'places', sketchId, 'The crater sings at dawn.');
    canvas = linkSketchSourceNote(canvas, 'places', sketchId, 'note-1');
    canvas = linkSketchEntity(canvas, 'places', sketchId, 'entity-1');
    canvas = {
      ...collapseLens(canvas, 'places'),
      premise: 'A city survives inside a glass crater.'
    };

    await saveWorldCanvas(canvas);

    await expect(getWorldCanvasByProjectId(projectId)).resolves.toEqual(canvas);
    expect((await getWorldCanvasByProjectId(projectId))?.lenses[0]).toMatchObject({
      isCollapsed: true
    });
    expect((await getWorldCanvasByProjectId(projectId))?.lenses[0].sketches[0]).toMatchObject({
      text: 'The crater sings at dawn.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1']
    });
    await expect(getWorldCanvasByProjectId(`${projectId}-missing`)).resolves.toBeNull();
  });
});
