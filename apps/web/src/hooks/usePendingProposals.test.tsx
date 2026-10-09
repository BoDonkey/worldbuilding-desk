import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LoreDocument, LoreFactProposal} from '../entityTypes';
import {usePendingProposals} from './usePendingProposals';

const storage = vi.hoisted(() => ({
  getLoreFactProposalsByProject: vi.fn(),
  getLoreDocumentsByProject: vi.fn()
}));
vi.mock('../services/lore/loreFactStorage', () => ({
  getLoreFactProposalsByProject: storage.getLoreFactProposalsByProject
}));
vi.mock('../loreStorage', () => ({getLoreDocumentsByProject: storage.getLoreDocumentsByProject}));

const proposal = (id: string, status: LoreFactProposal['status'] = 'proposed') =>
  ({id, loreDocumentId: 'note-1', status}) as LoreFactProposal;
const note = {id: 'note-1', title: 'Harbor rumors'} as LoreDocument;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

beforeEach(() => {
  storage.getLoreFactProposalsByProject.mockReset();
  storage.getLoreDocumentsByProject.mockReset().mockResolvedValue([note]);
});

describe('usePendingProposals', () => {
  it('is disabled until the author asks, loading until both reads finish, then ready', async () => {
    const proposals = deferred<LoreFactProposal[]>();
    storage.getLoreFactProposalsByProject.mockReturnValue(proposals.promise);
    const {result, rerender} = renderHook(({enabled}) => usePendingProposals('project-1', enabled), {
      initialProps: {enabled: false}
    });
    expect(result.current.state).toEqual({status: 'disabled'});
    expect(storage.getLoreFactProposalsByProject).not.toHaveBeenCalled();

    rerender({enabled: true});
    expect(result.current.state).toEqual({status: 'loading'});

    await act(async () => proposals.resolve([proposal('p1'), proposal('p2', 'accepted')]));
    expect(result.current.state).toMatchObject({status: 'ready'});
    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.context.proposals.map((entry) => entry.id)).toEqual(['p1']);
    expect(state.context.sourceTitleById.get('note-1')).toBe('Harbor rumors');
  });

  it('reports a failed read as an error, never as zero proposals, and recovers on retry', async () => {
    storage.getLoreFactProposalsByProject.mockRejectedValueOnce(new Error('disk unavailable'));
    const {result} = renderHook(() => usePendingProposals('project-1', true));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({message: expect.stringContaining('disk unavailable')});

    storage.getLoreFactProposalsByProject.mockResolvedValue([proposal('p1')]);
    act(() => result.current.retry());
    expect(result.current.state).toEqual({status: 'loading'});
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('keeps only the newest of overlapping reloads', async () => {
    const first = deferred<LoreFactProposal[]>();
    const second = deferred<LoreFactProposal[]>();
    storage.getLoreFactProposalsByProject
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const {result} = renderHook(() => usePendingProposals('project-1', true));

    act(() => {
      window.dispatchEvent(new CustomEvent('wbd:lore-fact-records-changed'));
    });
    await act(async () => second.resolve([proposal('newer')]));
    await act(async () => first.resolve([proposal('older')]));

    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.context.proposals.map((entry) => entry.id)).toEqual(['newer']);
  });

  it('turns off at once and ignores a read that finishes afterwards', async () => {
    const proposals = deferred<LoreFactProposal[]>();
    storage.getLoreFactProposalsByProject.mockReturnValue(proposals.promise);
    const {result, rerender} = renderHook(({enabled}) => usePendingProposals('project-1', enabled), {
      initialProps: {enabled: true}
    });

    rerender({enabled: false});
    expect(result.current.state).toEqual({status: 'disabled'});
    await act(async () => proposals.resolve([proposal('late')]));
    expect(result.current.state).toEqual({status: 'disabled'});

    storage.getLoreFactProposalsByProject.mockReturnValue(new Promise(() => {}));
    rerender({enabled: true});
    expect(result.current.state).toEqual({status: 'loading'});
  });
});
