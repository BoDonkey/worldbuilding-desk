import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {requestToPromise, transactionToPromise} from './idbRequest';
import * as storage from '.';

const openScratchDb = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('items', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

describe('idbRequest helpers', () => {
  it('resolves request results and transaction completion', async () => {
    const db = await openScratchDb('idb-request-ok');
    const tx = db.transaction('items', 'readwrite');
    const key = await requestToPromise(tx.objectStore('items').put({id: 'a', value: 1}));
    await transactionToPromise(tx);
    expect(key).toBe('a');
    const read = db.transaction('items').objectStore('items').get('a');
    expect(await requestToPromise(read)).toEqual({id: 'a', value: 1});
    db.close();
  });

  it('rejects a failed request and an aborted transaction', async () => {
    const db = await openScratchDb('idb-request-fail');
    const tx = db.transaction('items', 'readwrite');
    const completion = transactionToPromise(tx);
    await requestToPromise(tx.objectStore('items').add({id: 'a'}));
    const duplicate = tx.objectStore('items').add({id: 'a'});
    await expect(requestToPromise(duplicate)).rejects.toMatchObject({name: 'ConstraintError'});
    await expect(completion).rejects.toBeDefined();
    db.close();
  });
});

describe('storage index', () => {
  it('exposes repositories but not the database connection', () => {
    expect(typeof storage.getEntitiesByProject).toBe('function');
    expect(typeof storage.getRulesetByProjectId).toBe('function');
    expect('openDb' in storage).toBe(false);
    expect('upgradeDatabase' in storage).toBe(false);
    expect('DB_NAME' in storage).toBe(false);
  });
});
