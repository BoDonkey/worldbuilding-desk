import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AssistantContextSources} from './AssistantContextSources';
import {getContextSourceRefs} from '../../services/assistant/contextSources';

const storage = vi.hoisted(() => ({
  getLoreDocumentsByProject: vi.fn(),
  getEntitiesByProject: vi.fn()
}));
vi.mock('../../services/storage', () => storage);

const NOTE = 'General Source Note: project reference, not automatically canon - Salt Roads';
const DELETED_NOTE = 'General Source Note: project reference, not automatically canon - Old Draft';
const RECORD = 'Accepted canon: World Bible record - Mira';
const SCENE = 'Scene draft - Chapter One';

function Opened() {
  const location = useLocation();
  return <p>opened {location.pathname} {JSON.stringify(location.state)}</p>;
}

function renderSources() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route
          path='/workspace'
          element={
            <AssistantContextSources
              projectId='project-1'
              sources={[NOTE, DELETED_NOTE, RECORD, SCENE]}
              sourceRefs={[
                {source: NOTE, kind: 'source-note', id: 'note-1'},
                {source: DELETED_NOTE, kind: 'source-note', id: 'note-gone'},
                {source: RECORD, kind: 'world-bible', id: 'entity-1'}
              ]}
              leftOutSources={['Rules reference - Combat']}
            />
          }
        />
        <Route path='*' element={<Opened />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AssistantContextSources (5.17)', () => {
  beforeEach(() => {
    storage.getLoreDocumentsByProject.mockResolvedValue([{id: 'note-1'}]);
    storage.getEntitiesByProject.mockResolvedValue([{id: 'entity-1'}]);
  });

  it('offers Open only for sources whose record still exists', async () => {
    renderSources();
    expect(await screen.findByRole('button', {name: `Open ${NOTE}`})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: `Open ${RECORD}`})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: `Open ${DELETED_NOTE}`})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: `Open ${SCENE}`})).not.toBeInTheDocument();
    expect(storage.getLoreDocumentsByProject).toHaveBeenCalledWith('project-1');
  });

  it('opens the exact Source Note or World Bible record', async () => {
    const first = renderSources();
    fireEvent.click(await screen.findByRole('button', {name: `Open ${NOTE}`}));
    expect(screen.getByText(/opened \/lore/)).toHaveTextContent('{"focusLoreDocumentId":"note-1"}');
    first.unmount();

    renderSources();
    fireEvent.click(await screen.findByRole('button', {name: `Open ${RECORD}`}));
    expect(screen.getByText(/opened \/world-bible/)).toHaveTextContent('{"focusEntityId":"entity-1"}');
  });

  it('lets every card be dismissed, linked or not', async () => {
    renderSources();
    await screen.findByRole('button', {name: `Open ${NOTE}`});
    for (const source of [NOTE, DELETED_NOTE, RECORD, SCENE, 'Rules reference - Combat']) {
      fireEvent.click(screen.getByRole('button', {name: `Dismiss ${source}`}));
      expect(screen.queryByText(source)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Sources used')).not.toBeInTheDocument();
  });
});

describe('getContextSourceRefs', () => {
  it('keeps one record per source label and skips chunks without one', () => {
    expect(
      getContextSourceRefs([
        {content: 'a', source: NOTE, sourceRef: {kind: 'source-note', id: 'note-1'}},
        {content: 'b', source: NOTE, sourceRef: {kind: 'source-note', id: 'note-1'}},
        {content: 'c', source: SCENE}
      ])
    ).toEqual([{source: NOTE, kind: 'source-note', id: 'note-1'}]);
  });
});
