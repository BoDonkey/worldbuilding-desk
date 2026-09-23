import {fireEvent, render as rtlRender, screen, within} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import {addOpenThread, createEmptyWorldCanvas, getActiveSketch, openLens, updateSketchText} from '../../services/worldBible/worldCanvasService';
import {WorldCanvasView} from './WorldCanvasView';

const buildWorldCanvas = (overrides: Partial<ReturnType<typeof useWorldCanvas>> = {}): ReturnType<typeof useWorldCanvas> => ({
  canvas: createEmptyWorldCanvas('project-1'), status: 'saved', lastSavedAt: null,
  setPremise: vi.fn(), openLens: vi.fn(), collapseLens: vi.fn(), setSketchText: vi.fn(),
  selectSketch: vi.fn(), addAnotherSketch: vi.fn(), keepSketchAsOpenThread: vi.fn(),
  addOpenThread: vi.fn(), updateOpenThread: vi.fn(), keepCoreIdeaAsSourceNote: vi.fn(),
  developSketchAsSourceNote: vi.fn(), keepOpenThreadAsSourceNote: vi.fn(),
  keepBrainstormItemAsSourceNote: vi.fn(), linkCoreIdeaSourceNote: vi.fn(),
  linkCoreIdeaEntity: vi.fn(), linkSketchSourceNote: vi.fn(), linkSketchEntity: vi.fn(),
  unlinkSketchTarget: vi.fn(), linkOpenThreadSourceNote: vi.fn(), linkOpenThreadEntity: vi.fn(),
  pinReference: vi.fn(), unpinReference: vi.fn(), applyCoachingProposal: vi.fn(),
  ...overrides
});
const render = (ui: ReactElement) => rtlRender(ui, {wrapper: MemoryRouter});

describe('WorldCanvasView', () => {
  it('renders all lenses, Core Idea bridges, and no Worth a Look surface', () => {
    render(<WorldCanvasView worldCanvas={buildWorldCanvas()} />);
    expect(screen.getByText(/nothing here is canon/i)).toBeInTheDocument();
    expect(screen.getAllByText('Bring into focus')).toHaveLength(7);
    expect(screen.getByRole('heading', {name: 'Open Threads'})).toBeInTheDocument();
    expect(screen.queryByText('Worth a look')).not.toBeInTheDocument();
  });

  it('opens a lens and autosaves its working sketch', () => {
    const openLensAction = vi.fn(); const setSketchText = vi.fn(); const empty = createEmptyWorldCanvas('project-1');
    const {rerender} = render(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas: empty, openLens: openLensAction, setSketchText})} />);
    fireEvent.click(screen.getByRole('button', {name: 'Bring Inhabitants and societies into focus'}));
    expect(openLensAction).toHaveBeenCalledWith('people');
    const opened = openLens(empty, 'people');
    rerender(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas: opened, setSketchText})} />);
    fireEvent.change(screen.getByLabelText('Inhabitants and societies working sketch'), {target: {value: 'Names and tensions'}});
    expect(setSketchText).toHaveBeenCalledWith('people', getActiveSketch(opened.lenses[0]).id, 'Names and tensions');
  });

  it('keeps a routed sketch in history and explicitly starts another', () => {
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'customs');
    const first = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'customs', first.id, 'Bears are considered unclean.');
    canvas.lenses[0].sketches[0].linkedOpenThreadIds = ['thread-1'];
    canvas.openThreads = [{id: 'thread-1', text: 'Bears are considered unclean.', status: 'open', lensKind: 'customs', createdAt: 1, updatedAt: 1}];
    const addAnotherSketch = vi.fn();
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas, addAnotherSketch})} />);
    fireEvent.click(screen.getByRole('button', {name: 'Add another sketch'}));
    expect(addAnotherSketch).toHaveBeenCalledWith('customs');
    expect(screen.getByText(/Open Thread:/)).toBeInTheDocument();
  });

  it('adds statement-form Open Threads and validates blank input', () => {
    const addOpenThread = vi.fn();
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({addOpenThread})} />);
    fireEvent.click(screen.getByRole('button', {name: 'Add open thread'}));
    expect(screen.getByLabelText('Add an open thread')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Add an open thread'), {target: {value: 'The founders lied.'}});
    fireEvent.change(screen.getByLabelText('Lens (optional)'), {target: {value: 'history'}});
    fireEvent.click(screen.getByRole('button', {name: 'Add open thread'}));
    expect(addOpenThread).toHaveBeenCalledWith('The founders lied.', 'history');
  });

  it('routes a sketch through Source Notes and the normal World Bible form', () => {
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'people');
    const sketch = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'people', sketch.id, 'Sera Vale');
    const developSketchAsSourceNote = vi.fn().mockResolvedValue(null); const onProposeCanon = vi.fn();
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas, developSketchAsSourceNote})} categories={[{id: 'characters', projectId: 'project-1', kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}]} onProposeCanon={onProposeCanon} />);
    const article = screen.getByText('Inhabitants and societies', {selector: 'h4'}).closest('article')!;
    fireEvent.click(within(article).getByRole('button', {name: 'Develop as Source Note'}));
    expect(developSketchAsSourceNote).toHaveBeenCalledWith('people', sketch.id);
    fireEvent.click(within(article).getByRole('button', {name: 'Propose canon anchor'}));
    expect(screen.getByLabelText('Record name')).toHaveValue('Sera Vale');
    fireEvent.click(screen.getByRole('button', {name: 'Open World Bible form'}));
    expect(onProposeCanon).toHaveBeenCalledWith(expect.objectContaining({name: 'Sera Vale', target: {type: 'sketch', kind: 'people', sketchId: sketch.id}}));
  });

  it('collapses Settled and Set aside threads into reopenable history', () => {
    let canvas = addOpenThread(createEmptyWorldCanvas('project-1'), 'Who owns the gate?');
    canvas.openThreads[0].status = 'settled';
    canvas = addOpenThread(canvas, 'The gate may choose its keeper.');
    canvas.openThreads[1].status = 'set_aside';
    const updateOpenThread = vi.fn();
    render(<WorldCanvasView worldCanvas={buildWorldCanvas({canvas, updateOpenThread})} />);
    fireEvent.click(screen.getByText(/Settled and set-aside history/));
    expect(screen.getByText('Who owns the gate?')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: 'Reopen'})[0]);
    expect(updateOpenThread).toHaveBeenCalledWith(canvas.openThreads[0].id, {status: 'open'});
  });

  it('keeps deterministic suggestions separate and pins one to its mapped lens', () => {
    const pinReference = vi.fn().mockResolvedValue(null);
    render(<WorldCanvasView
      worldCanvas={buildWorldCanvas({pinReference})}
      categories={[{id: 'characters', projectId: 'project-1', kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}]}
      entities={[{id: 'sera', projectId: 'project-1', categoryId: 'characters', name: 'Sera Kestrel', fields: {}, links: [], createdAt: 1, updatedAt: 1}]}
    />);
    fireEvent.click(screen.getByText('Suggested references (1)'));
    const card = screen.getByText('Sera Kestrel').closest('[data-canvas-reference]') as HTMLElement;
    expect(within(card).getByText('Accepted canon')).toBeInTheDocument();
    expect(within(card).getByText(/category maps to this lens/i)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', {name: 'Pin'}));
    expect(pinReference).toHaveBeenCalledWith({sourceType: 'world-bible', id: 'sera'}, 'people');
  });

  it('shows renamed and stale pinned references with open and unpin actions', () => {
    const canvas = {...createEmptyWorldCanvas('project-1'), coreIdeaSourceNoteId: 'note-1', coreIdeaEntityId: 'missing'};
    const onOpenSourceNote = vi.fn();
    const unpinReference = vi.fn().mockResolvedValue(null);
    render(<WorldCanvasView
      worldCanvas={buildWorldCanvas({canvas, unpinReference})}
      loreDocuments={[{id: 'note-1', projectId: 'project-1', title: 'Renamed Foundation Note', kind: 'general_lore', format: 'plain_text', content: '', source: {type: 'manual'}, status: 'active', createdAt: 1, updatedAt: 2}]}
      onOpenSourceNote={onOpenSourceNote}
    />);
    const noteCard = screen.getByText('Renamed Foundation Note', {selector: 'strong'}).closest('[data-canvas-reference]') as HTMLElement;
    fireEvent.click(within(noteCard).getByRole('button', {name: 'Open'}));
    expect(onOpenSourceNote).toHaveBeenCalledWith('note-1');
    const staleCard = screen.getByText('No longer exists', {selector: 'strong'}).closest('[data-canvas-reference]') as HTMLElement;
    expect(within(staleCard).getByText('Missing source')).toBeInTheDocument();
    expect(within(staleCard).queryByRole('button', {name: 'Open'})).not.toBeInTheDocument();
    fireEvent.click(within(staleCard).getByRole('button', {name: 'Unpin'}));
    expect(unpinReference).toHaveBeenCalledWith({sourceType: 'world-bible', id: 'missing'});
  });
});
