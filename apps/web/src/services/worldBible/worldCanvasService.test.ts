import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LENS_DEFINITIONS, addAnotherSketch, addOpenThread, buildSourceNoteFromCoreIdea,
  buildSourceNoteFromOpenThread, buildSourceNoteFromSketch, collapseLens,
  createEmptyWorldCanvas, getActiveSketch, linkSketchEntity, linkSketchSourceNote,
  migrateWorldCanvasDocument, openLens, resolveCanvasLinks, routeSketchToOpenThread,
  selectSketch, updateOpenThread, updateSketchText
} from './worldCanvasService';

describe('worldCanvasService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a v2 project-owned canvas with seven reusable lenses', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10);
    expect(createEmptyWorldCanvas('project-1')).toMatchObject({schemaVersion: 2, id: 'project-1', projectId: 'project-1', premise: '', lenses: [], openThreads: [], createdAt: 10, updatedAt: 10});
    expect(LENS_DEFINITIONS).toHaveLength(7);
  });

  it('migrates every legacy lens note/link and question status without loss', () => {
    const migrated = migrateWorldCanvasDocument({
      id: 'project-1', projectId: 'project-1', premise: 'A memory city',
      lenses: [{kind: 'places', note: 'The crater sings.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1'], isCollapsed: true, updatedAt: 8}],
      questions: [
        {id: 'q1', text: 'Who listens?', status: 'open', createdAt: 2, updatedAt: 3},
        {id: 'q2', text: 'The founders lied.', status: 'answered', createdAt: 4, updatedAt: 5},
        {id: 'q3', text: 'Maybe the river remembers.', status: 'dropped', createdAt: 6, updatedAt: 7}
      ], createdAt: 1, updatedAt: 9
    });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.lenses[0]).toMatchObject({activeSketchId: 'legacy-project-1-places', isCollapsed: true});
    expect(migrated.lenses[0].sketches[0]).toEqual({id: 'legacy-project-1-places', text: 'The crater sings.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1'], linkedOpenThreadIds: [], createdAt: 8, updatedAt: 8});
    expect(migrated.openThreads.map((item) => item.status)).toEqual(['open', 'settled', 'set_aside']);
  });

  it('keeps routed sketches as history and starts another only after routing', () => {
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'constraints');
    const first = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'constraints', first.id, 'Magic leaves a debt.');
    expect(() => addAnotherSketch(canvas, 'constraints')).toThrow('Route this sketch');
    canvas = routeSketchToOpenThread(canvas, 'constraints', first.id);
    canvas = addAnotherSketch(canvas, 'constraints');
    expect(canvas.lenses[0].sketches).toHaveLength(2);
    expect(canvas.openThreads[0]).toMatchObject({text: 'Magic leaves a debt.', lensKind: 'constraints', status: 'open'});
    expect(getActiveSketch(canvas.lenses[0]).text).toBe('');
    canvas = selectSketch(canvas, 'constraints', first.id);
    expect(getActiveSketch(canvas.lenses[0]).text).toBe('Magic leaves a debt.');
  });

  it('collapses and reopens without changing sketches or destinations', () => {
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'customs');
    const sketch = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'customs', sketch.id, 'Bears are considered unclean.');
    canvas = linkSketchSourceNote(canvas, 'customs', sketch.id, 'note-1');
    canvas = linkSketchEntity(canvas, 'customs', sketch.id, 'entity-1');
    const collapsed = collapseLens(canvas, 'customs');
    const reopened = openLens(collapsed, 'customs');
    expect(reopened.lenses[0].sketches[0]).toMatchObject({text: 'Bears are considered unclean.', linkedSourceNoteIds: ['note-1'], linkedEntityIds: ['entity-1']});
  });

  it('accepts statement- and question-form Open Threads and retains history', () => {
    let canvas = addOpenThread(createEmptyWorldCanvas('project-1'), 'Who pays the price?', 'power');
    canvas = addOpenThread(canvas, 'The treaty protects the city and traps its founders.');
    canvas = updateOpenThread(canvas, canvas.openThreads[0].id, {status: 'settled'});
    canvas = updateOpenThread(canvas, canvas.openThreads[1].id, {status: 'set_aside'});
    expect(canvas.openThreads.map((item) => [item.text, item.status])).toEqual([
      ['Who pays the price?', 'settled'],
      ['The treaty protects the city and traps its founders.', 'set_aside']
    ]);
  });

  it('builds provenance-marked snapshot notes without changing the source text', () => {
    let canvas = {...createEmptyWorldCanvas('project-1'), premise: 'A city powered by borrowed memories.'};
    const core = buildSourceNoteFromCoreIdea(canvas);
    canvas = openLens(canvas, 'factions');
    const sketch = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'factions', sketch.id, 'The Cinder Compact');
    const sketchNote = buildSourceNoteFromSketch(getActiveSketch(canvas.lenses[0]), 'factions', canvas);
    const threadCanvas = addOpenThread(canvas, 'Who funds the Compact?', 'factions');
    const threadNote = buildSourceNoteFromOpenThread(threadCanvas.openThreads[0], 'project-1');
    expect(core.content).toBe('From World Canvas — Core Idea\n\nA city powered by borrowed memories.');
    expect(sketchNote.content).toBe('From World Canvas — Factions and institutions\n\nThe Cinder Compact');
    expect(threadNote.content).toBe('From World Canvas — Open Thread (Factions and institutions)\n\nWho funds the Compact?');
  });

  it('resolves stale links visibly', () => {
    expect(resolveCanvasLinks(['entity-1', 'missing'], [{id: 'entity-1', name: 'Sera'}], (item) => item.name)).toEqual([
      {id: 'entity-1', label: 'Sera', missing: false},
      {id: 'missing', label: 'no longer exists', missing: true}
    ]);
  });
});
