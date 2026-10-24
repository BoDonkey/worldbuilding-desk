import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {useCollapsedPreference} from './useCollapsedPreference';

describe('useCollapsedPreference', () => {
  it('reads the stored choice for each key and remembers toggles', () => {
    localStorage.setItem('rail:a', 'true');
    const {result, rerender} = renderHook(({storageKey}) => useCollapsedPreference(storageKey), {
      initialProps: {storageKey: 'rail:a' as string | null}
    });
    expect(result.current.collapsed).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem('rail:a')).toBe('false');

    rerender({storageKey: 'rail:b'});
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(localStorage.getItem('rail:b')).toBe('true');

    rerender({storageKey: 'rail:a'});
    expect(result.current.collapsed).toBe(false);
  });

  it('stays expanded and unstored without a key; setCollapsed is not remembered', () => {
    const {result, rerender} = renderHook(({storageKey}) => useCollapsedPreference(storageKey), {
      initialProps: {storageKey: null as string | null}
    });
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.length).toBe(0);

    rerender({storageKey: 'rail:c'});
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem('rail:c')).toBeNull();
  });
});
