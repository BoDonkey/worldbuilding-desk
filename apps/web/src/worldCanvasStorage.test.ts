import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {getWorldCanvasByProjectId, saveWorldCanvas} from './worldCanvasStorage';
import {createEmptyWorldCanvas, openLens} from './services/worldBible/worldCanvasService';

describe('worldCanvasStorage', () => {
  it('round-trips the project singleton through its projectId index', async () => {
    const projectId = `canvas-storage-${crypto.randomUUID()}`;
    const canvas = {
      ...openLens(createEmptyWorldCanvas(projectId), 'places'),
      premise: 'A city survives inside a glass crater.'
    };

    await saveWorldCanvas(canvas);

    await expect(getWorldCanvasByProjectId(projectId)).resolves.toEqual(canvas);
    await expect(getWorldCanvasByProjectId(`${projectId}-missing`)).resolves.toBeNull();
  });
});
