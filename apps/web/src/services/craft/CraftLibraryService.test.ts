import {describe, expect, it, vi} from 'vitest';
import {CraftLibraryService} from './CraftLibraryService';
import type {
  CraftEmbeddingContract,
  CraftLibraryManifest,
  CraftQueryEmbedder
} from './types';

const embedding: CraftEmbeddingContract = {
  model: 'token-embedder',
  version: '1',
  dimensions: 2,
  normalization: 'l2'
};

function createManifest(): CraftLibraryManifest {
  return {
    schemaVersion: 1,
    contentVersion: 'test-1',
    sourceDigest: 'test-digest',
    embedding,
    chunks: [
      createChunk({
        id: 'scene-goals',
        title: 'Scene goals',
        content: 'A scene goal gives the viewpoint character something specific to pursue.',
        vector: [1, 0]
      }),
      createChunk({
        id: 'tension-release',
        title: 'Tension and release',
        content: 'Alternating pressure and release can shape a chapter rhythm.',
        vector: [0, 1]
      })
    ]
  };
}

function createChunk(options: {
  id: string;
  title: string;
  content: string;
  vector: number[];
}): CraftLibraryManifest['chunks'][number] {
  return {
    id: options.id,
    recordId: `craft.test.${options.id}`,
    recordVersion: 1,
    title: options.title,
    section: 'What it is',
    content: options.content,
    embedding: options.vector,
    metadata: {
      type: 'craft',
      authorVetted: true,
      documentType: 'pattern',
      family: 'general',
      detectability: 'model-assisted',
      scopes: ['scene'],
      genres: ['general-fiction'],
      subgenres: [],
      exclusions: [],
      modifiers: [],
      tags: ['token'],
      aliases: [],
      sourceConfidence: 'high',
      citations: [{id: 'source-1', label: 'Test craft source'}]
    }
  };
}

describe('CraftLibraryService', () => {
  it('retrieves a token library offline with labeled craft provenance', async () => {
    const service = new CraftLibraryService(createManifest());

    const results = await service.search('viewpoint scene goal');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      retrievalMode: 'lexical',
      chunk: {id: 'scene-goals', metadata: {type: 'craft'}},
      provenance: {
        role: 'craft-reference',
        label: 'Vetted craft reference',
        contentVersion: 'test-1',
        citations: [{id: 'source-1', label: 'Test craft source'}]
      }
    });
  });

  it('uses shipped vectors only with an exactly compatible query embedder', async () => {
    const embed = vi.fn(async () => [0, 1]);
    const service = new CraftLibraryService(createManifest(), {contract: embedding, embed});

    const results = await service.search('unmatched vocabulary');

    expect(embed).toHaveBeenCalledOnce();
    expect(results[0]).toMatchObject({
      retrievalMode: 'hybrid',
      chunk: {id: 'tension-release'}
    });
  });

  it('falls back to lexical search when the embedding contract is incompatible', async () => {
    const embed = vi.fn(async () => [1, 0]);
    const incompatible: CraftQueryEmbedder = {
      contract: {...embedding, version: '2'},
      embed
    };
    const service = new CraftLibraryService(createManifest(), incompatible);

    const results = await service.search('pressure chapter rhythm');

    expect(embed).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      retrievalMode: 'lexical',
      chunk: {id: 'tension-release'}
    });
  });

  it('falls back to lexical search when compatible embedding generation fails', async () => {
    const service = new CraftLibraryService(createManifest(), {
      contract: embedding,
      embed: async () => {
        throw new Error('model unavailable');
      }
    });

    const results = await service.search('scene goal');

    expect(results[0]).toMatchObject({retrievalMode: 'lexical'});
  });

  it('is safe with an empty library and empty queries', async () => {
    const manifest = createManifest();
    manifest.chunks = [];
    const emptyService = new CraftLibraryService(manifest);
    const tokenService = new CraftLibraryService(createManifest());

    await expect(emptyService.search('scene')).resolves.toEqual([]);
    await expect(tokenService.search('   ')).resolves.toEqual([]);
    await expect(tokenService.search('scene', 0)).resolves.toEqual([]);
  });

  it('rejects unvetted or vector-incompatible bundled chunks', () => {
    const unvetted = createManifest();
    unvetted.chunks[0]!.metadata.authorVetted = false as true;
    expect(() => new CraftLibraryService(unvetted)).toThrow('is not vetted');

    const wrongDimensions = createManifest();
    wrongDimensions.chunks[0]!.embedding = [1];
    expect(() => new CraftLibraryService(wrongDimensions)).toThrow(
      'has an incompatible embedding'
    );
  });
});
