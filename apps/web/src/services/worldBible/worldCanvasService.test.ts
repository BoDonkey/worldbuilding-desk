import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LENS_DEFINITIONS,
  buildSourceNoteFromBrainstormItem,
  buildSourceNoteFromLens,
  buildSourceNoteFromQuestion,
  addQuestion,
  collapseLens,
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

  it('collapses and reopens a lens without changing its note or links', () => {
    const opened = linkLensEntity(
      linkLensSourceNote(
        updateLensNote(createEmptyWorldCanvas('project-1'), 'customs', 'Bears are considered unclean.'),
        'customs',
        'note-1'
      ),
      'customs',
      'entity-1'
    );
    const collapsed = collapseLens(opened, 'customs');
    const reopened = openLens(collapsed, 'customs');

    expect(collapsed.lenses[0].isCollapsed).toBe(true);
    expect(reopened.lenses[0]).toMatchObject({
      note: 'Bears are considered unclean.',
      linkedSourceNoteIds: ['note-1'],
      linkedEntityIds: ['entity-1'],
      isCollapsed: false
    });
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

  it('marks kept brainstorm items as model-suggested Source Notes, kind by lens', () => {
    const lensNote = buildSourceNoteFromBrainstormItem({
      projectId: 'project-1',
      lensKind: 'factions',
      kindLabel: 'Tension',
      text: 'The Compact needs the city to forget.'
    });
    const premiseNote = buildSourceNoteFromBrainstormItem({
      projectId: 'project-1',
      kindLabel: 'Question',
      text: 'Who remembers the founders?'
    });

    expect(lensNote).toMatchObject({
      projectId: 'project-1',
      kind: 'faction_notes',
      source: {type: 'manual'},
      content: 'From World Canvas brainstorm — Factions and institutions (Tension)\n\nThe Compact needs the city to forget.'
    });
    expect(premiseNote).toMatchObject({
      kind: 'general_lore',
      content: 'From World Canvas brainstorm — Core Idea (Question)\n\nWho remembers the founders?'
    });
    expect(() => buildSourceNoteFromBrainstormItem({
      projectId: 'project-1',
      kindLabel: 'Tension',
      text: '  '
    })).toThrow();
  });

  it('records brainstorm origin on a question only when given', () => {
    const canvas = createEmptyWorldCanvas('project-1');
    const authored = addQuestion(canvas, 'Who owns the gate?', 'places');
    const fromBrainstorm = addQuestion(authored, 'Who remembers the founders?', undefined, 'brainstorm');

    expect(fromBrainstorm.questions[0]).not.toHaveProperty('origin');
    expect(fromBrainstorm.questions[1]).toMatchObject({
      text: 'Who remembers the founders?',
      origin: 'brainstorm',
      status: 'open'
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
