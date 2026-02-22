import {
  ShodhMemoryService,
  CompositeShodhMemoryService
} from './ShodhMemoryService';
import type {ShodhMemoryProvider} from './ShodhMemoryService';

export interface ShodhServiceOptions {
  projectId: string;
  inheritFromParent?: boolean;
  parentProjectId?: string;
}

const cache = new Map<string, Promise<ShodhMemoryProvider>>();

async function createProvider(projectId: string) {
  const service = new ShodhMemoryService();
  await service.init(projectId);
  return service;
}

export function getShodhService(
  options: ShodhServiceOptions | string
): Promise<ShodhMemoryProvider> {
  const normalized: ShodhServiceOptions =
    typeof options === 'string'
      ? {projectId: options}
      : options;
  const {projectId, inheritFromParent, parentProjectId} = normalized;
  const cacheKey = [
    projectId,
    inheritFromParent ? parentProjectId ?? '' : '',
    inheritFromParent ? 'inherit' : 'solo'
  ].join('|');

  if (!cache.has(cacheKey)) {
    const initPromise = (async () => {
      const primary = await createProvider(projectId);
      if (inheritFromParent && parentProjectId) {
        const parent = await createProvider(parentProjectId);
        return new CompositeShodhMemoryService(primary, [parent]);
      }
      return primary;
    })();
    cache.set(cacheKey, initPromise);
  }

  return cache.get(cacheKey)!;
}
