import {RAGService, CompositeRAGService} from './RAGService';
import type {RAGProvider} from './RAGService';

export interface RagServiceOptions {
  projectId: string;
  inheritFromParent?: boolean;
  parentProjectId?: string;
}

const serviceCache = new Map<string, {
  projectIds: string[];
  service: Promise<RAGProvider>;
}>();

async function createProvider(projectId: string) {
  const service = new RAGService();
  await service.init(projectId);
  return service;
}

export function getRAGService(
  options: RagServiceOptions | string
): Promise<RAGProvider> {
  const normalized: RagServiceOptions =
    typeof options === 'string'
      ? {projectId: options}
      : options;
  const {projectId, inheritFromParent, parentProjectId} = normalized;
  const cacheKey = [
    projectId,
    inheritFromParent && parentProjectId ? parentProjectId : '',
    inheritFromParent ? 'inherit' : 'solo'
  ].join('|');

  if (!serviceCache.has(cacheKey)) {
    const initPromise = (async () => {
      const primary = await createProvider(projectId);
      try {
        if (inheritFromParent && parentProjectId) {
          const parent = await createProvider(parentProjectId);
          return new CompositeRAGService(primary, [parent]);
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
    serviceCache.set(cacheKey, entry);
    initPromise.catch(() => {
      if (serviceCache.get(cacheKey) === entry) serviceCache.delete(cacheKey);
    });
  }

  return serviceCache.get(cacheKey)!.service;
}

/** Release every cached provider that owns a connection to this project, including inherited views. */
export async function closeRAGServices(projectId: string): Promise<void> {
  const closing: Promise<void>[] = [];
  for (const [key, entry] of serviceCache) {
    if (!entry.projectIds.includes(projectId)) continue;
    serviceCache.delete(key);
    // Failed initialization has no usable provider to close.
    closing.push(entry.service.then((service) => service.close?.(), () => undefined));
  }
  await Promise.all(closing);
}
