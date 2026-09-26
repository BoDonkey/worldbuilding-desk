import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import LoreRoute from './LoreRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';

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
});
