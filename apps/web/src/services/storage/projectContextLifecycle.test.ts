import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {getRAGService, closeRAGServices} from '../rag/getRAGService';
import {RAGService} from '../rag/RAGService';
import {getShodhService, closeShodhServices} from '../shodh/getShodhService';
import {ShodhMemoryService} from '../shodh/ShodhMemoryService';

const providers = [
  {name: 'retrieval', get: getRAGService, close: closeRAGServices, prototype: RAGService.prototype},
  {name: 'memory', get: getShodhService, close: closeShodhServices, prototype: ShodhMemoryService.prototype}
];

afterEach(() => vi.restoreAllMocks());

describe.each(providers)('$name provider lifecycle', ({get, close, prototype}) => {
  it('allows a retry after initialization rejects', async () => {
    const id = crypto.randomUUID();
    vi.spyOn(prototype, 'init').mockRejectedValueOnce(new Error('Initialization failed'));
    await expect(get(id)).rejects.toThrow('Initialization failed');
    try {
      await expect(get(id)).resolves.toBeDefined();
    } finally {
      await close(id);
    }
  });

  it('closes a primary connection when parent initialization fails', async () => {
    const id = crypto.randomUUID();
    const parent = crypto.randomUUID();
    vi.spyOn(prototype, 'init').mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Parent unavailable'));
    const closeSpy = vi.spyOn(prototype, 'close');
    await expect(get({projectId: id, inheritFromParent: true, parentProjectId: parent}))
      .rejects.toThrow('Parent unavailable');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    await close(id);
  });

  it('waits for initialization before closing and leaves unrelated providers cached', async () => {
    const id = crypto.randomUUID();
    const other = crypto.randomUUID();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    vi.spyOn(prototype, 'init').mockReturnValueOnce(gate);
    const closeSpy = vi.spyOn(prototype, 'close');
    const pending = get(id);
    const closing = close(id);
    expect(closeSpy).not.toHaveBeenCalled();
    finish();
    const old = await pending;
    await closing;
    expect(closeSpy).toHaveBeenCalledTimes(1);
    try {
      const otherService = await get(other);
      expect(await get(id)).not.toBe(old);
      await close(id);
      expect(await get(other)).toBe(otherService);
    } finally {
      await close(id);
      await close(other);
    }
  });
});
