import {RAGService, CompositeRAGService} from './RAGService';

export interface RagServiceOptions {
  projectId: string;
  inheritFromParent?: boolean;
  parentProjectId?: string;
}

const serviceCache = new Map<string, Promise<RAGService>>();

async function createProvider(projectId: string) {
  const service = new RAGService();
  await service.init(projectId);
  return service;
}

export function getRAGService(
  options: RagServiceOptions | string
): Promise<RAGService> {
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
      if (inheritFromParent && parentProjectId) {
        const parent = await createProvider(parentProjectId);
        return new CompositeRAGService(primary, [parent]);
      }
      return primary;
    })();
    serviceCache.set(cacheKey, initPromise);
  }

  return serviceCache.get(cacheKey)!;
}
