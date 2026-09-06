import {bundledCraftLibrary} from '../../generated/craftLibrary.generated';
import {CraftLibraryService} from './CraftLibraryService';
import {createCraftQueryEmbedder} from './createCraftQueryEmbedder';
import type {CraftLibraryProvider} from './types';

let service: CraftLibraryProvider | null = null;

export function getCraftLibraryService(): CraftLibraryProvider {
  if (!service) {
    service = new CraftLibraryService(
      bundledCraftLibrary,
      createCraftQueryEmbedder(bundledCraftLibrary.embedding)
    );
  }
  return service;
}
