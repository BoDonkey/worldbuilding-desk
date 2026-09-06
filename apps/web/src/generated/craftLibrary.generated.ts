import type {CraftLibraryManifest} from '../services/craft/types';
import rawManifest from './craftLibrary.generated.data.json?raw';

// Loader for craftLibrary.generated.data.json, produced by scripts/build-craft-library.mjs.
// Do not hand-edit the data file. This loader is hand-written and stable; it need not
// be regenerated when the data changes.
export const bundledCraftLibrary = JSON.parse(rawManifest) as CraftLibraryManifest;
