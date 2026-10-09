import {act, fireEvent, render, screen, within} from '@testing-library/react';
import type {Editor} from '@tiptap/core';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AccessibilityProvider} from '../../contexts/AccessibilityContext';
import {SourceNoteContentField} from './SourceNoteContentField';
import type {SourceNoteContentView} from './SourceNoteContentField';
import type {LoreDocumentFormat} from '../../entityTypes';

const Harness = ({
  initial,
  initialFormat = 'markdown',
  onChange,
  onFormatChange = () => {}
}: {
  initial: string;
  initialFormat?: LoreDocumentFormat;
  onChange: (value: string) => void;
  onFormatChange?: (format: LoreDocumentFormat) => void;
}) => {
  const [content, setContent] = useState(initial);
  const [format, setFormat] = useState(initialFormat);
  const [view, setView] = useState<SourceNoteContentView | null>(null);
  return (
    <AccessibilityProvider>
      <SourceNoteContentField
        content={content}
        format={format}
        view={view}
        onViewChange={setView}
        onChange={(next) => {
          setContent(next);
          onChange(next);
        }}
        onFormatChange={(next) => {
          setFormat(next);
          onFormatChange(next);
        }}
      />
    </AccessibilityProvider>
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

const editorFor = (): Editor =>
  (screen.getByRole('textbox', {name: 'Content'}) as HTMLElement & {editor: Editor}).editor;

describe('SourceNoteContentField visual editor', () => {
  it('shows Markdown formatted for editing without reporting a change on open', () => {
    const onChange = vi.fn();
    render(<Harness initial={'## Background\n\n* Loyal\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'} onChange={onChange} />);

    const surface = screen.getByRole('textbox', {name: 'Content'});
    expect(within(surface).getByRole('heading', {name: 'Background', level: 2})).toBeInTheDocument();
    expect(within(surface).getByRole('cell', {name: '2'})).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the original text when an edit is undone, and writes Markdown for a real edit', () => {
    const original = '* Loyal\n\n__Strong__ words';
    const onChange = vi.fn();
    render(<Harness initial={original} onChange={onChange} />);

    act(() => {
      editorFor().chain().focus('end').insertContent('!').run();
    });
    expect(onChange).toHaveBeenLastCalledWith('- Loyal\n\n**Strong** words!');

    act(() => {
      editorFor().commands.undo();
    });
    expect(onChange).toHaveBeenLastCalledWith(original);
  });

  it('switches to the Markdown source and back, showing source edits in the editor', () => {
    const onChange = vi.fn();
    render(<Harness initial='Plain start' onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', {name: 'Edit Markdown'}));
    const textarea = screen.getByRole('textbox', {name: 'Content'});
    expect(textarea).toHaveValue('Plain start');
    fireEvent.change(textarea, {target: {value: '# Retitled'}});

    fireEvent.click(screen.getByRole('button', {name: 'Visual editor'}));
    expect(
      within(screen.getByRole('textbox', {name: 'Content'})).getByRole('heading', {name: 'Retitled'})
    ).toBeInTheDocument();
  });

  it('inserts a table from the toolbar and offers table actions inside it', () => {
    const onChange = vi.fn();
    render(<Harness initial='Intro' onChange={onChange} />);

    act(() => {
      editorFor().commands.focus('end');
    });
    fireEvent.click(screen.getByRole('button', {name: 'Insert table'}));
    expect(onChange.mock.lastCall?.[0]).toMatch(/^Intro\n\n\| {3}\| {3}\| {3}\|\n\| --- \| --- \| --- \|/);
    expect(screen.getByRole('button', {name: 'Add row'})).toBeInTheDocument();
  });

  it('shows a plain-text note as written and makes it Markdown only once it is edited', () => {
    const original = 'Name: Mira *the* Bold\n# not a heading\n\nSecond paragraph';
    const onChange = vi.fn();
    const onFormatChange = vi.fn();
    render(
      <Harness
        initial={original}
        initialFormat='plain_text'
        onChange={onChange}
        onFormatChange={onFormatChange}
      />
    );

    const surface = screen.getByRole('textbox', {name: 'Content'});
    expect(surface).toHaveTextContent('Name: Mira *the* Bold# not a heading');
    expect(within(surface).queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit text'})).toBeInTheDocument();

    act(() => {
      editorFor().chain().focus('end').insertContent('.').run();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      'Name: Mira \\*the\\* Bold\n\\# not a heading\n\nSecond paragraph.'
    );
    expect(onFormatChange).toHaveBeenLastCalledWith('markdown');

    act(() => {
      editorFor().commands.undo();
    });
    expect(onChange).toHaveBeenLastCalledWith(original);
    expect(onFormatChange).toHaveBeenLastCalledWith('plain_text');
  });

  it('opens in Markdown source when the author prefers it, and remembers a switch only on request', () => {
    window.localStorage.setItem('sourceNoteView', 'markdown');
    render(<Harness initial='# Heading' onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', {name: 'Content'})).toHaveValue('# Heading');
    expect(screen.queryByRole('button', {name: 'Always open notes this way'})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Visual editor'}));
    expect(
      within(screen.getByRole('textbox', {name: 'Content'})).getByRole('heading', {name: 'Heading'})
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('sourceNoteView')).toBe('markdown');

    fireEvent.click(screen.getByRole('button', {name: 'Always open notes this way'}));
    expect(window.localStorage.getItem('sourceNoteView')).toBe('visual');
    expect(screen.queryByRole('button', {name: 'Always open notes this way'})).not.toBeInTheDocument();
  });
});
