import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SourceNoteStarterPanel} from './SourceNoteStarterPanel';

beforeEach(() => {
  window.localStorage.clear();
});

describe('SourceNoteStarterPanel', () => {
  it('collapses to one row that keeps both actions, and remembers the choice', () => {
    const onImport = vi.fn();
    const onStartWriting = vi.fn();
    const {unmount} = render(
      <SourceNoteStarterPanel isImporting={false} onImport={onImport} onStartWriting={onStartWriting} />
    );

    const toggle = screen.getByRole('button', {name: 'Hide intro'});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', {name: 'Write Manually'})).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', {name: 'Show intro'})).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', {name: 'Write Manually'})).not.toBeInTheDocument();
    expect(screen.queryByText(/Capture longform material first/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Import File'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Import File'}));
    fireEvent.click(screen.getByRole('button', {name: 'Start Writing'}));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onStartWriting).toHaveBeenCalledTimes(1);

    unmount();
    render(<SourceNoteStarterPanel isImporting={false} onImport={onImport} onStartWriting={onStartWriting} />);
    expect(screen.getByRole('button', {name: 'Show intro'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Show intro'}));
    expect(screen.getByRole('heading', {name: 'Import Dossier'})).toBeInTheDocument();
    expect(window.localStorage.getItem('wbd:lore:starter-collapsed')).toBe('false');
  });
});
