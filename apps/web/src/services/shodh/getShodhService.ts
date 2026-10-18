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

const cache = new Map<string, {
  projectIds: string[];
  service: Promise<ShodhMemoryProvider>;
}>();

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
      try {
        if (inheritFromParent && parentProjectId) {
          const parent = await createProvider(parentProjectId);
          return new CompositeShodhMemoryService(primary, [parent]);
        }
        return primary;
      } catch (error) {
        primary.close();
        throw error;
      }
    })();
    const entry = {
      projectIds: inheritFromParent && parentProjectId ? [projectId, parentProjectId] : [projectId],
      service: initPromise
    };
    cache.set(cacheKey, entry);
    initPromise.catch(() => {
      if (cache.get(cacheKey) === entry) cache.delete(cacheKey);
    });
  }

  return cache.get(cacheKey)!.service;
}

/** Release every cached provider that owns a connection to this project, including inherited views. */
export async function closeShodhServices(projectId: string): Promise<void> {
  const closing: Promise<void>[] = [];
  for (const [key, entry] of cache) {
    if (!entry.projectIds.includes(projectId)) continue;
    cache.delete(key);
    // Failed initialization has no usable provider to close.
    closing.push(entry.service.then((service) => service.close?.(), () => undefined));
  }
  await Promise.all(closing);
}
