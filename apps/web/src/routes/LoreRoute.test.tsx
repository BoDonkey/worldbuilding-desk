import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import LoreRoute from './LoreRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';
import {getLoreDocumentsByProject, saveLoreDocument} from '../services/storage';
import {SUGGESTED_DETAILS_HEADING} from '../services/lore/sourceNoteOrigin';

const indexGate = vi.hoisted(() => {
  let release: () => void = () => {};
  let promise: Promise<void> = Promise.resolve();
  return {
    hold() {
      promise = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release: () => release(),
    wait: () => promise
  };
});

vi.mock('../services/rag/getRAGService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/rag/getRAGService')>();
  return {
    ...actual,
    getRAGService: async (...args: Parameters<typeof actual.getRAGService>) => {
      const service = await actual.getRAGService(...args);
      const indexDocument = service.indexDocument.bind(service);
      service.indexDocument = async (...indexArgs: Parameters<typeof service.indexDocument>) => {
        await indexGate.wait();
        return indexDocument(...indexArgs);
      };
      return service;
    }
  };
});

beforeEach(() => {
  seedRouteTestState();
});

describe('LoreRoute', () => {
  it('holds note actions until a save, including its links and indexing, finishes', async () => {
    renderRoute(<LoreRoute />, '/lore');
    await screen.findByRole('heading', {name: 'Source Notes', level: 1});

    fireEvent.change(screen.getByLabelText('Title'), {target: {value: 'Late Save Note'}});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Markdown'}));
    fireEvent.change(screen.getByLabelText('Content'), {
      target: {value: 'Background: Saved before indexing finished.'}
    });

    indexGate.hold();
    fireEvent.click(screen.getByRole('button', {name: 'Create Source Note'}));

    // The note is listed as soon as its record is written, before the rest of
    // the save; opening it then would start from missing links.
    const listedTitle = await screen.findByText('Late Save Note', {selector: 'article *'});
    const listed = listedTitle.closest('article') as HTMLElement;
    expect(within(listed).getByRole('button', {name: 'Edit'})).toBeDisabled();
    expect(within(listed).getByRole('button', {name: 'Delete'})).toBeDisabled();

    indexGate.release();
    await waitFor(() => {
      expect(within(listed).getByRole('button', {name: 'Edit'})).toBeEnabled();
    });
    expect(screen.getByRole('heading', {name: 'New Source Note', level: 2})).toBeInTheDocument();

    fireEvent.click(within(listed).getByRole('button', {name: 'Edit'}));
    expect(
      await screen.findByRole('heading', {name: 'Edit Source Note', level: 2})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Late Save Note');
    expect(screen.getByRole('button', {name: 'Extract Candidates'})).toBeEnabled();
  });

  it('labels a note saved from an AI session and keeps its suggested details out of extraction', async () => {
    const base = {
      projectId: 'route-smoke-project',
      kind: 'character_dossier' as const,
      format: 'plain_text' as const,
      status: 'active' as const,
      createdAt: 1,
      updatedAt: 1
    };
    await saveLoreDocument({
      ...base,
      id: 'note-typed',
      title: 'Typed Note',
      content: 'Occupation: weaver',
      source: {type: 'manual'}
    });
    await saveLoreDocument({
      ...base,
      id: 'note-lab',
      title: 'Character lab: Wren',
      content: `Occupation: ferry pilot\n\n${SUGGESTED_DETAILS_HEADING}\n- Age: 41\n- Height: towering`,
      source: {type: 'ai-session', sessionId: 'session-1'}
    });

    renderRoute(<LoreRoute />, '/lore');
    const typed = (await screen.findByText('Typed Note', {selector: 'article h3'})).closest('article') as HTMLElement;
    const lab = screen.getByText('Character lab: Wren', {selector: 'article h3'}).closest('article') as HTMLElement;
    expect(within(lab).getByText('From an AI session')).toBeInTheDocument();
    expect(within(typed).queryByText('From an AI session')).not.toBeInTheDocument();

    fireEvent.click(within(lab).getByRole('button', {name: 'Edit'}));
    await screen.findByRole('heading', {name: 'Edit Source Note', level: 2});
    expect(screen.getByText(/Parts of it may have been written by a model, not by you/)).toBeInTheDocument();
    expect(screen.getByText(/evidence quoted under a candidate may be model-written/)).toBeInTheDocument();
    expect(screen.getByText(/Extraction skips everything from the/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Extract Candidates'}));
    expect(await screen.findByText('ferry pilot')).toBeInTheDocument();
    expect(screen.queryByText('41')).not.toBeInTheDocument();
    expect(screen.queryByText('towering')).not.toBeInTheDocument();

    fireEvent.click(within(typed).getByRole('button', {name: 'Edit'}));
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Typed Note'));
    expect(screen.queryByText(/Parts of it may have been written by a model/)).not.toBeInTheDocument();
    expect(screen.queryByText(/evidence quoted under a candidate may be model-written/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Extraction skips everything from the/)).not.toBeInTheDocument();
  });

  it('imports Markdown into the visual editor and keeps it Markdown when saved', async () => {
    const {container} = renderRoute(<LoreRoute />, '/lore');
    await screen.findByRole('heading', {name: 'Source Notes', level: 1});

    const markdown = [
      '## Background',
      '- **Age:** Mid-30s',
      '',
      '| Trait | Value |',
      '| --- | --- |',
      '| Height | Tall |'
    ].join('\n');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {files: [new File([markdown], 'Camila.md', {type: 'text/markdown'})]}
    });

    // A new note already shows an empty editor; wait for the imported text.
    await screen.findByRole('heading', {name: 'Background', level: 2});
    const formatted = screen.getByRole('textbox', {name: 'Content'});
    expect(within(formatted).getByRole('heading', {name: 'Background', level: 2})).toBeInTheDocument();
    expect(within(formatted).getByRole('cell', {name: 'Tall'})).toBeInTheDocument();
    expect(within(formatted).queryByText(/\*\*/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Edit Markdown'}));
    expect(screen.getByLabelText('Content')).toHaveValue(markdown);

    fireEvent.click(screen.getByRole('button', {name: 'Create Source Note'}));
    const listedTitle = await screen.findByText('Camila', {selector: 'article h3'});
    await waitFor(() => {
      expect(
        within(listedTitle.closest('article') as HTMLElement).getByRole('button', {name: 'Edit'})
      ).toBeEnabled();
    });

    const [saved] = await getLoreDocumentsByProject('route-smoke-project');
    expect(saved).toMatchObject({title: 'Camila', format: 'markdown', content: markdown});

    fireEvent.click(
      within(listedTitle.closest('article') as HTMLElement).getByRole('button', {name: 'Edit'})
    );
    const reopened = await screen.findByRole('textbox', {name: 'Content'});
    expect(within(reopened).getByRole('heading', {name: 'Background', level: 2})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit Markdown'})).toBeInTheDocument();
  });

  it('opens new, imported, and saved notes in Markdown source when the author prefers it', async () => {
    window.localStorage.setItem('sourceNoteView', 'markdown');
    const {container} = renderRoute(<LoreRoute />, '/lore');
    await screen.findByRole('heading', {name: 'Source Notes', level: 1});
    expect(screen.getByLabelText('Content')).toHaveValue('');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {files: [new File(['## Background'], 'Leo.md', {type: 'text/markdown'})]}
    });
    await waitFor(() => expect(screen.getByLabelText('Content')).toHaveValue('## Background'));
    fireEvent.click(screen.getByRole('button', {name: 'Create Source Note'}));

    const listedTitle = await screen.findByText('Leo', {selector: 'article h3'});
    const listed = listedTitle.closest('article') as HTMLElement;
    await waitFor(() => expect(within(listed).getByRole('button', {name: 'Edit'})).toBeEnabled());
    fireEvent.click(within(listed).getByRole('button', {name: 'Edit'}));
    await screen.findByRole('heading', {name: 'Edit Source Note', level: 2});
    expect(screen.getByLabelText('Content')).toHaveValue('## Background');
    window.localStorage.removeItem('sourceNoteView');
  });
});
