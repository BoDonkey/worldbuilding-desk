import {CraftLibraryService} from './CraftLibraryService';
import {createCraftQueryEmbedder} from './createCraftQueryEmbedder';
import type {CraftLibraryProvider} from './types';

let servicePromise: Promise<CraftLibraryProvider> | null = null;

/**
 * The bundled manifest is a multi-megabyte generated data file (the full
 * craft-library corpus plus its embedding vectors). It is loaded via a
 * dynamic import so it ships as its own chunk, fetched only when a coaching
 * feature actually runs, rather than bloating the main application bundle
 * that every page load downloads.
 */
export async function getCraftLibraryService(): Promise<CraftLibraryProvider> {
  if (!servicePromise) {
    servicePromise = import('../../generated/craftLibrary.generated').then(
      ({bundledCraftLibrary}) =>
        new CraftLibraryService(
          bundledCraftLibrary,
          createCraftQueryEmbedder(bundledCraftLibrary.embedding)
        )
    );
  }
  return servicePromise;
}
