import 'fake-indexeddb/auto';
import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {appendToScratchpad, getScratchpadByProjectId, saveScratchpad} from '../scratchpadStorage';
import {useWorkspaceScratchpad} from './useWorkspaceScratchpad';

const seed = (projectId: string, content: string) =>
  saveScratchpad({id: projectId, projectId, content, createdAt: 1, updatedAt: 1});

describe('appendToScratchpad', () => {
  it('appends to the saved scratchpad, creating it when missing', async () => {
    const projectId = `scratchpad-${crypto.randomUUID()}`;
    await appendToScratchpad(projectId, '<p>first</p>');
    await appendToScratchpad(projectId, '<p>second</p>');

    expect((await getScratchpadByProjectId(projectId))?.content).toBe('<p>first</p><p>second</p>');
  });

  it('keeps an open scratchpad in step, so its next save does not drop the append', async () => {
    const projectId = `scratchpad-${crypto.randomUUID()}`;
    await seed(projectId, '<p>notes</p>');
    const {result} = renderHook(() => useWorkspaceScratchpad(projectId));
    await waitFor(() => expect(result.current.scratchpadStatus).toBe('saved'));

    act(() => result.current.setScratchpadContent('<p>notes edited</p>'));
    await act(() => appendToScratchpad(projectId, '<p>lab</p>'));

    expect(result.current.scratchpadContent).toBe('<p>notes edited</p><p>lab</p>');
    await waitFor(
      async () =>
        expect((await getScratchpadByProjectId(projectId))?.content).toBe('<p>notes edited</p><p>lab</p>'),
      {timeout: 3000}
    );
  });

  it('ignores appends to other projects', async () => {
    const projectId = `scratchpad-${crypto.randomUUID()}`;
    await seed(projectId, '<p>mine</p>');
    const {result} = renderHook(() => useWorkspaceScratchpad(projectId));
    await waitFor(() => expect(result.current.scratchpadStatus).toBe('saved'));

    await act(() => appendToScratchpad(`other-${crypto.randomUUID()}`, '<p>theirs</p>'));

    expect(result.current.scratchpadContent).toBe('<p>mine</p>');
  });
});
