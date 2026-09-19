import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LENS_DEFINITIONS,
  buildSourceNoteFromLens,
  buildSourceNoteFromQuestion,
  addQuestion,
  createEmptyWorldCanvas,
  linkLensEntity,
  linkLensSourceNote,
  openLens,
  resolveCanvasLinks,
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

  it('builds manual Source Notes with visible canvas provenance and the lens kind map', () => {
    vi.spyOn(Date, 'now').mockReturnValue(30);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const canvas = updateLensNote(createEmptyWorldCanvas('project-1'), 'factions', 'The Cinder Compact');
    const lensNote = buildSourceNoteFromLens(canvas.lenses[0], canvas);
    const questionCanvas = addQuestion(canvas, 'Who funds the Compact?', 'factions');
    const questionNote = buildSourceNoteFromQuestion(questionCanvas.questions[0], 'project-1');

    expect(lensNote).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      projectId: 'project-1',
      title: 'The Cinder Compact',
      kind: 'faction_notes',
      source: {type: 'manual'},
      content: 'From World Canvas — Factions and institutions\n\nThe Cinder Compact'
    });
    expect(questionNote).toMatchObject({
      kind: 'faction_notes',
      source: {type: 'manual'},
      content: 'From World Canvas — Question (Factions and institutions)\n\nWho funds the Compact?'
    });
  });

  it('keeps stable links and resolves deleted targets as missing', () => {
    const canvas = openLens(createEmptyWorldCanvas('project-1'), 'people');
    const linked = linkLensEntity(
      linkLensSourceNote(canvas, 'people', 'note-1'),
      'people',
      'entity-1'
    );

    expect(linked.lenses[0]).toMatchObject({
      linkedSourceNoteIds: ['note-1'],
      linkedEntityIds: ['entity-1']
    });
    expect(resolveCanvasLinks(['entity-1', 'missing'], [{id: 'entity-1', name: 'Sera'}], (item) => item.name))
      .toEqual([
        {id: 'entity-1', label: 'Sera', missing: false},
        {id: 'missing', label: 'no longer exists', missing: true}
      ]);
  });
});
