import {describe, expect, it} from 'vitest';
import {nextPendingDraftId} from './useImportDraftFocus';

describe('nextPendingDraftId (4.99)', () => {
  const drafts = [
    {id: 'a', status: 'imported' as const},
    {id: 'b'},
    {id: 'c', parseError: 'Unreadable'},
    {id: 'd', status: 'failed' as const}
  ];

  it('picks the next draft still to import, skipping imported and unreadable ones', () => {
    expect(nextPendingDraftId(drafts, 'b')).toBe('d');
  });

  it('wraps to the top and never returns the draft just imported', () => {
    expect(nextPendingDraftId(drafts, 'd')).toBe('b');
    expect(nextPendingDraftId([{id: 'a'}], 'a')).toBeNull();
  });
});
