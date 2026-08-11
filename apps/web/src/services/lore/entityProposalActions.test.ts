import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Character, LoreEntityProposal, WorldEntity} from '../../entityTypes';

const mocks = vi.hoisted(() => ({
  ensureCanonicalCharacterForIntake: vi.fn(),
  getCharactersByProject: vi.fn(),
  saveCharacter: vi.fn(),
  replaceLoreDocumentLinks: vi.fn()
}));

vi.mock('../characters/characterIntakeService', () => ({
  ensureCanonicalCharacterForIntake: mocks.ensureCanonicalCharacterForIntake
}));
vi.mock('../../characterStorage', () => ({
  getCharactersByProject: mocks.getCharactersByProject,
  saveCharacter: mocks.saveCharacter
}));
vi.mock('../../loreStorage', () => ({
  replaceLoreDocumentLinks: mocks.replaceLoreDocumentLinks
}));

import {acceptLoreEntityProposal} from './entityProposalActions';

const canonicalEntity: WorldEntity = {
  id: 'entity-mira',
  projectId: 'project-1',
  categoryId: 'characters',
  name: 'Mira Voss',
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1
};

const proposal = (overrides: Partial<LoreEntityProposal> = {}): LoreEntityProposal => ({
  id: 'proposal-1',
  projectId: 'project-1',
  loreDocumentId: 'lore-1',
  entityKind: 'character',
  name: 'Mira Voss',
  confidence: 0.9,
  evidence: {text: 'Mira Voss drew the map.', start: 0, end: 9},
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('acceptLoreEntityProposal character intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureCanonicalCharacterForIntake.mockResolvedValue({entity: canonicalEntity});
    mocks.getCharactersByProject.mockResolvedValue([]);
  });

  it('accepts a new character proposal as World Bible canon, not a free-standing tool record', async () => {
    const result = await acceptLoreEntityProposal({proposal: proposal(), existingLinks: []});

    expect(result).toEqual({targetType: 'entity', targetId: canonicalEntity.id});
    expect(mocks.ensureCanonicalCharacterForIntake).toHaveBeenCalledWith(
      expect.objectContaining({projectId: 'project-1', name: 'Mira Voss'})
    );
    expect(mocks.saveCharacter).not.toHaveBeenCalled();
    expect(mocks.replaceLoreDocumentLinks).toHaveBeenCalledWith({
      loreDocumentId: 'lore-1',
      links: [expect.objectContaining({targetType: 'entity', targetId: canonicalEntity.id})]
    });
  });

  it('canonicalizes an explicitly selected legacy tool record before linking lore', async () => {
    const legacyCharacter: Character = {
      id: 'character-mira',
      projectId: 'project-1',
      name: 'Mira Voss',
      description: 'A cartographer.',
      fields: {role: 'Cartographer'},
      createdAt: 1,
      updatedAt: 1
    };
    mocks.getCharactersByProject.mockResolvedValue([legacyCharacter]);

    const result = await acceptLoreEntityProposal({
      proposal: proposal({targetType: 'character', targetId: legacyCharacter.id}),
      existingLinks: []
    });

    expect(result).toEqual({targetType: 'entity', targetId: canonicalEntity.id});
    expect(mocks.saveCharacter).toHaveBeenCalledWith(
      expect.objectContaining({id: legacyCharacter.id, entityId: canonicalEntity.id})
    );
    expect(mocks.replaceLoreDocumentLinks).toHaveBeenCalledWith({
      loreDocumentId: 'lore-1',
      links: [expect.objectContaining({targetType: 'entity', targetId: canonicalEntity.id})]
    });
  });
});
