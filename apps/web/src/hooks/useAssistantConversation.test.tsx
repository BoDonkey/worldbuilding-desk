import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  loadAssistantConversation,
  useAssistantConversation
} from './useAssistantConversation';

describe('useAssistantConversation', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('restores project chat after the assistant unmounts during navigation', () => {
    const first = renderHook(() => useAssistantConversation('project-a'));

    act(() => {
      first.result.current[1]([
        {role: 'user', content: "What color are Sera's eyes?"},
        {
          role: 'assistant',
          content: "Sera's eyes are gray.",
          contextSources: ['Accepted canon: World Bible record - Sera Kestrel']
        }
      ]);
    });
    first.unmount();

    const second = renderHook(() => useAssistantConversation('project-a'));
    expect(second.result.current[0]).toHaveLength(2);
    expect(second.result.current[0][1].content).toBe("Sera's eyes are gray.");
  });

  it('keeps conversations scoped by project and ignores invalid saved data', () => {
    const alpha = renderHook(() => useAssistantConversation('alpha'));
    act(() => alpha.result.current[1]([{role: 'user', content: 'Alpha question'}]));

    expect(loadAssistantConversation('beta')).toEqual([]);
    window.sessionStorage.setItem(
      'wbd:assistant-conversation:broken',
      JSON.stringify([{role: 'assistant', content: 42}])
    );
    expect(loadAssistantConversation('broken')).toEqual([]);
  });
});
