import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ChapterCard} from '../../entityTypes';
import {WorkspaceChapterCardContext} from './WorkspaceChapterCardContext';

const card = (id: string, title: string): ChapterCard => ({
  id, projectId: 'project-1', title, summary: '', status: 'planned', order: 0,
  sceneIds: ['scene-1'], plotPoints: [], createdAt: 1, updatedAt: 1
});

describe('WorkspaceChapterCardContext', () => {
  it('renders nothing for an unlinked scene', () => {
    const {container} = render(<WorkspaceChapterCardContext
      cards={[]}
      onOpenCard={vi.fn()}
      onOpenCorkboard={vi.fn()}
    />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names one card and opens either Corkboard surface with its id', () => {
    const onOpenCard = vi.fn();
    const onOpenCorkboard = vi.fn();
    render(<WorkspaceChapterCardContext
      cards={[card('card-1', 'The Salt Door')]}
      onOpenCard={onOpenCard}
      onOpenCorkboard={onOpenCorkboard}
    />);

    expect(screen.getByText('The Salt Door')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Open card'}));
    fireEvent.click(screen.getByRole('button', {name: 'Corkboard'}));
    expect(onOpenCard).toHaveBeenCalledWith('card-1');
    expect(onOpenCorkboard).toHaveBeenCalledWith('card-1');
  });

  it('expands several cards into keyboard-operable chips', () => {
    const onOpenCard = vi.fn();
    render(<WorkspaceChapterCardContext
      cards={[card('card-1', 'First'), card('card-2', 'Second')]}
      onOpenCard={onOpenCard}
      onOpenCorkboard={vi.fn()}
    />);

    expect(screen.getByText('2 chapter cards')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Open card Second'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Show cards'}));
    fireEvent.click(screen.getByRole('button', {name: 'Open card Second'}));
    expect(onOpenCard).toHaveBeenCalledWith('card-2');
  });
});
