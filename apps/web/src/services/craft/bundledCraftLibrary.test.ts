import {describe, expect, it} from 'vitest';
import {bundledCraftLibrary} from '../../generated/craftLibrary.generated';
import {CraftLibraryService} from './CraftLibraryService';

describe('bundled craft library tranche 2', () => {
  it('packages the full 166-record author-vetted corpus with cited provenance', () => {
    const recordIds = new Set(bundledCraftLibrary.chunks.map((chunk) => chunk.recordId));
    expect(recordIds.size).toBe(166);
    expect(bundledCraftLibrary.contentVersion).toBe('2.0.0-tranche-2');
    expect(bundledCraftLibrary.chunks.every(
      (chunk) => chunk.metadata.authorVetted === true && chunk.metadata.citations.length > 0
    )).toBe(true);
  });

  it('retrieves a vetted pattern with labeled citations without a query embedder', async () => {
    const service = new CraftLibraryService(bundledCraftLibrary);
    const results = await service.search('problems power cannot solve grief');

    expect(results[0]).toMatchObject({
      retrievalMode: 'lexical',
      chunk: {
        recordId: 'craft.general.plot.negative-space-problems-power-cannot-solve'
      },
      provenance: {
        role: 'craft-reference',
        label: 'Vetted craft reference',
        contentVersion: '2.0.0-tranche-2'
      }
    });
    expect(results[0]!.provenance.citations[0]!.label).toBeTruthy();
  });
});
