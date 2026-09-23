import {fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ChapterCard, WritingDocument} from '../../entityTypes';
import {resetNotificationsForTests, useNotificationStore} from '../../store/notificationStore';
import {ChapterCardSceneLinks} from './ChapterCardSceneLinks';

const card = (sceneIds: string[]): ChapterCard => ({
  id: 'card-1', projectId: 'project-1', title: 'The Salt Door', summary: '',
  status: 'planned', order: 0, sceneIds, plotPoints: [], createdAt: 1, updatedAt: 1
});
const documents: WritingDocument[] = ['One', 'Two', 'Three', 'Four'].map((title, index) => ({
  id: `scene-${index + 1}`, projectId: 'project-1', title, content: '', createdAt: index, updatedAt: index
}));

afterEach(resetNotificationsForTests);

describe('ChapterCardSceneLinks', () => {
  it('keeps the compact checklist collapsed and caps visible scene chips', () => {
    const onToggle = vi.fn();
    render(<ChapterCardSceneLinks
      card={card(documents.map((document) => document.id))}
      documents={documents}
      currentDocumentId='scene-1'
      onToggle={onToggle}
      onRemoveMissing={vi.fn()}
      compact
    />);

    expect(screen.getAllByText('One')).toHaveLength(2);
    expect(screen.getAllByText('Two')).toHaveLength(2);
    expect(screen.getAllByText('Three')).toHaveLength(2);
    expect(screen.getAllByText('Four')).toHaveLength(1);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.getByText('Manage links').closest('details')).not.toHaveAttribute('open');

    fireEvent.click(screen.getByRole('button', {name: 'Unlink current scene One from The Salt Door'}));
    expect(onToggle).toHaveBeenCalledWith('scene-1');
    expect(useNotificationStore.getState().announcement?.message)
      .toBe('Unlinked One from The Salt Door.');
  });

  it('opens the full checklist, exposes linked scenes, and removes stale links explicitly', () => {
    const onRemoveMissing = vi.fn();
    const onOpenScene = vi.fn();
    render(<ChapterCardSceneLinks
      card={card(['scene-2', 'missing-scene'])}
      documents={documents}
      onToggle={vi.fn()}
      onRemoveMissing={onRemoveMissing}
      onOpenScene={onOpenScene}
    />);

    const details = screen.getByText('Manage links').closest('details')!;
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('Scene no longer exists')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Open scene Two'}));
    expect(onOpenScene).toHaveBeenCalledWith('scene-2');
    fireEvent.click(within(screen.getByText('Scene no longer exists').closest('span')!).getByRole('button', {name: /Remove missing scene link/}));
    expect(onRemoveMissing).toHaveBeenCalledWith('missing-scene');
  });
});
