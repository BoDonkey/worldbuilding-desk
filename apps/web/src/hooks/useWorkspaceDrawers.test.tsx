import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';
import {useWorkspaceDrawers} from './useWorkspaceDrawers';

const stubViewport = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
};

describe('useWorkspaceDrawers', () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState(), true);
  });

  it('allows both drawers on desktop and selects the requested context view', () => {
    const {result} = renderHook(() =>
      useWorkspaceDrawers({activeProjectId: 'project-a'})
    );

    act(() => result.current.toggleSceneDrawer());
    act(() => result.current.openContextDrawer('review'));

    expect(result.current.isSceneDrawerOpen).toBe(true);
    expect(result.current.isContextDrawerOpen).toBe(true);
    expect(result.current.activeContextView).toBe('review');
  });

  it('keeps narrow drawers mutually exclusive and closes the active drawer on Escape', () => {
    stubViewport(true);
    const {result} = renderHook(() =>
      useWorkspaceDrawers({activeProjectId: 'project-a'})
    );

    act(() => result.current.toggleSceneDrawer());
    expect(result.current.isSceneDrawerOpen).toBe(true);

    act(() => result.current.openContextDrawer('lore'));
    expect(result.current.isSceneDrawerOpen).toBe(false);
    expect(result.current.isContextDrawerOpen).toBe(true);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})));
    expect(result.current.isContextDrawerOpen).toBe(false);
  });
});
