import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import {ENTITY_STORE_NAME} from '../../db';
import {runProjectWriteTransaction} from './projectWriteTransaction';

describe('runProjectWriteTransaction', () => {
  it('commits every write and only then runs after-commit callbacks', async () => {
    const callback = vi.fn();
    const id = `tx-commit-${Date.now()}`;
    await runProjectWriteTransaction([ENTITY_STORE_NAME], async (tx) => {
      await tx.put(ENTITY_STORE_NAME, {id, projectId: 'p'});
      tx.afterCommit(callback);
      tx.afterCommit(callback);
      expect(callback).not.toHaveBeenCalled();
    });
    expect(callback).toHaveBeenCalledTimes(1);
    await runProjectWriteTransaction([ENTITY_STORE_NAME], async (tx) => {
      expect(await tx.get(ENTITY_STORE_NAME, id)).toEqual({id, projectId: 'p'});
    });
  });

  it('rolls back earlier writes and skips callbacks when the work throws', async () => {
    const callback = vi.fn();
    const id = `tx-abort-${Date.now()}`;
    await expect(
      runProjectWriteTransaction([ENTITY_STORE_NAME], async (tx) => {
        await tx.put(ENTITY_STORE_NAME, {id, projectId: 'p'});
        tx.afterCommit(callback);
        throw new Error('validation failed');
      })
    ).rejects.toThrow('validation failed');
    expect(callback).not.toHaveBeenCalled();
    await runProjectWriteTransaction([ENTITY_STORE_NAME], async (tx) => {
      expect(await tx.get(ENTITY_STORE_NAME, id)).toBeUndefined();
    });
  });
});
