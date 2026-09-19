import {fireEvent, render as rtlRender, screen} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import {addQuestion, createEmptyWorldCanvas, openLens} from '../../services/worldBible/worldCanvasService';
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
  keepBrainstormItemAsSourceNote: vi.fn(),
  linkLensSourceNote: vi.fn(),
  linkLensEntity: vi.fn(),
  unlinkLensTarget: vi.fn(),
  linkQuestionSourceNote: vi.fn(),
  linkQuestionEntity: vi.fn(),
  ...overrides
});

// The brainstorm panel links to Settings, so the view needs a router.
const render = (ui: ReactElement) => rtlRender(ui, {wrapper: MemoryRouter});

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

  it('offers brainstorming on the premise and opened lenses and marks brainstorm questions', () => {
    const canvas = addQuestion(
      addQuestion(openLens(createEmptyWorldCanvas('project-1'), 'people'), 'Who owns the gate?'),
      'Who remembers the founders?',
      undefined,
      'brainstorm'
    );
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas})} />);

    expect(screen.getAllByRole('button', {name: 'Ask for tensions and questions'})).toHaveLength(2);
    expect(screen.getByRole('heading', {name: 'Brainstorm: Premise'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Brainstorm: People'})).toBeInTheDocument();
    expect(screen.getAllByText('From World Canvas brainstorm')).toHaveLength(1);
  });
});
