import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LENS_DEFINITIONS,
  addQuestion,
  createEmptyWorldCanvas,
  openLens,
  updateLensNote,
  updateQuestion
} from './worldCanvasService';

describe('worldCanvasService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates an empty project-owned canvas and exposes the seven fixed lenses', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10);
    const canvas = createEmptyWorldCanvas('project-1');

    expect(canvas).toEqual({
      id: 'project-1',
      projectId: 'project-1',
      premise: '',
      lenses: [],
      questions: [],
      createdAt: 10,
      updatedAt: 10
    });
    expect(LENS_DEFINITIONS.map((lens) => lens.kind)).toEqual([
      'people', 'places', 'factions', 'history', 'power', 'customs', 'constraints'
    ]);
  });

  it('opens each lens once and updates freeform notes without creating fields', () => {
    const original = createEmptyWorldCanvas('project-1');
    const opened = openLens(original, 'constraints');
    const duplicate = openLens(opened, 'constraints');
    const updated = updateLensNote(duplicate, 'constraints', 'Magic always leaves a debt.');

    expect(duplicate).toBe(opened);
    expect(updated.lenses).toEqual([
      expect.objectContaining({
        kind: 'constraints',
        note: 'Magic always leaves a debt.',
        linkedSourceNoteIds: [],
        linkedEntityIds: []
      })
    ]);
  });

  it('adds and edits author questions while rejecting an empty add', () => {
    const canvas = createEmptyWorldCanvas('project-1');
    expect(() => addQuestion(canvas, '   ')).toThrow('Enter a question');

    const added = addQuestion(canvas, '  Who pays the price?  ', 'power');
    const question = added.questions[0];
    const updated = updateQuestion(added, question.id, {
      text: ' Who benefits? ',
      status: 'answered'
    });

    expect(question).toMatchObject({
      text: 'Who pays the price?',
      lensKind: 'power',
      status: 'open'
    });
    expect(updated.questions[0]).toMatchObject({
      text: 'Who benefits?',
      lensKind: 'power',
      status: 'answered'
    });
  });
});
