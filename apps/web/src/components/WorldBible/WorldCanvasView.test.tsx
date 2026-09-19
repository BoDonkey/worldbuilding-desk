import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import {createEmptyWorldCanvas, openLens} from '../../services/worldBible/worldCanvasService';
import {WorldCanvasView} from './WorldCanvasView';

const buildWorldCanvas = (
  overrides: Partial<ReturnType<typeof useWorldCanvas>> = {}
): ReturnType<typeof useWorldCanvas> => ({
  canvas: createEmptyWorldCanvas('project-1'),
  status: 'saved',
  lastSavedAt: null,
  setPremise: vi.fn(),
  openLens: vi.fn(),
  setLensNote: vi.fn(),
  addQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  keepLensAsSourceNote: vi.fn(),
  keepQuestionAsSourceNote: vi.fn(),
  linkLensSourceNote: vi.fn(),
  linkLensEntity: vi.fn(),
  unlinkLensTarget: vi.fn(),
  linkQuestionSourceNote: vi.fn(),
  linkQuestionEntity: vi.fn(),
  ...overrides
});

describe('WorldCanvasView', () => {
  it('renders the optional empty state and all seven unopened lenses', () => {
    render(<WorldCanvasView worldCanvas={buildWorldCanvas()} />);

    expect(screen.getByText(/nothing here is canon/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Open lens'})).toHaveLength(7);
    expect(screen.getByText(/What truth would change how people understand this world\?/)).toBeInTheDocument();
  });

  it('opens a lens and edits its freeform note', () => {
    const openLensAction = vi.fn();
    const setLensNote = vi.fn();
    const empty = createEmptyWorldCanvas('project-1');
    const {rerender} = render(
      <WorldCanvasView worldCanvas={buildWorldCanvas({canvas: empty, openLens: openLensAction, setLensNote})} />
    );

    fireEvent.click(screen.getAllByRole('button', {name: 'Open lens'})[0]);
    expect(openLensAction).toHaveBeenCalledWith('people');

    rerender(
      <WorldCanvasView
        worldCanvas={buildWorldCanvas({canvas: openLens(empty, 'people'), openLens: openLensAction, setLensNote})}
      />
    );
    fireEvent.change(screen.getByLabelText('People notes'), {target: {value: 'Names and tensions'}});
    expect(setLensNote).toHaveBeenCalledWith('people', 'Names and tensions');
  });

  it('validates and adds a question with an optional lens', () => {
    const addQuestion = vi.fn();
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({addQuestion})} />);

    fireEvent.click(screen.getByRole('button', {name: 'Add question'}));
    expect(screen.getByLabelText('New question')).toHaveAttribute('aria-invalid', 'true');
    expect(addQuestion).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('New question'), {target: {value: 'Who owns the gate?'}});
    fireEvent.change(screen.getByLabelText('Lens (optional)'), {target: {value: 'places'}});
    fireEvent.click(screen.getByRole('button', {name: 'Add question'}));

    expect(addQuestion).toHaveBeenCalledWith('Who owns the gate?', 'places');
  });

  it('offers Source Note and canon bridges without writing canon directly', () => {
    const keepLensAsSourceNote = vi.fn().mockResolvedValue(null);
    const onProposeCanon = vi.fn();
    const canvas = openLens(createEmptyWorldCanvas('project-1'), 'people');
    canvas.lenses[0].note = 'Sera Vale';
    render(
      <WorldCanvasView
        worldCanvas={buildWorldCanvas({canvas, keepLensAsSourceNote})}
        categories={[{
          id: 'characters', projectId: 'project-1', kind: 'character',
          name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1
        }]}
        onProposeCanon={onProposeCanon}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Keep as Source Note'}));
    expect(keepLensAsSourceNote).toHaveBeenCalledWith('people');

    fireEvent.click(screen.getByRole('button', {name: 'Propose as canon'}));
    expect(screen.getByLabelText('Canon record name')).toHaveValue('Sera Vale');
    fireEvent.click(screen.getByRole('button', {name: 'Open canon form'}));
    expect(onProposeCanon).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sera Vale',
      target: {type: 'lens', kind: 'people'}
    }));
  });
});
