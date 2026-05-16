import {describe, expect, it} from 'vitest';
import {buildExtractedProposal} from './ConsistencyEngineService';
import type {ExtractProposalInput} from './types';

const baseInput = (
  text: string,
  knownEntities: ExtractProposalInput['knownEntities'] = [],
  source: ExtractProposalInput['source'] = 'workspace-save'
): ExtractProposalInput => ({
  projectId: 'project-1',
  text,
  source,
  knownEntities
});

const entityRefsFor = (
  text: string,
  knownEntities: ExtractProposalInput['knownEntities'] = [],
  source: ExtractProposalInput['source'] = 'workspace-save'
) =>
  buildExtractedProposal(baseInput(text, knownEntities, source), {
    id: 'proposal-1',
    createdAt: 1
  }).entities;

const surfacesFor = (
  text: string,
  knownEntities: ExtractProposalInput['knownEntities'] = [],
  source: ExtractProposalInput['source'] = 'workspace-save'
): string[] =>
  entityRefsFor(text, knownEntities, source).map((entity) => entity.surface);

describe('buildExtractedProposal', () => {
  it('suppresses ordinary capitalized sentence starts', () => {
    expect(surfacesFor('Three candles burned on the altar.')).not.toContain(
      'Three'
    );
    expect(
      surfacesFor('Three candles burned on the altar.', [], 'import')
    ).not.toContain('Three');
  });

  it('suppresses participial sentence starts before known names', () => {
    const surfaces = surfacesFor(
      'Reflecting on the battle, John closed the door.',
      [{id: 'character-1', name: 'John', type: 'character'}]
    );

    expect(surfaces).not.toContain('Reflecting');
    expect(surfaces).toContain('John');
    expect(
      surfacesFor('Reflecting on the battle, John closed the door.', [], 'import')
    ).not.toContain('Reflecting');
  });

  it('does not flag reflective sentence starts from imported prose', () => {
    const surfaces = surfacesFor(
      'Reflecting back, I wondered if I had overemphasized the proto-Nincendi aspects of my project. Perhaps highlighting the broader applications of my research would have been wiser. Nonetheless, I believed I addressed Dr. Harrison’s query effectively.'
    );

    expect(surfaces).not.toContain('Reflecting');
    expect(surfaces).not.toContain('Perhaps');
    expect(surfaces).not.toContain('Nonetheless');
    expect(surfaces).toContain('Dr. Harrison');
    expect(
      entityRefsFor(
        'Reflecting back, I wondered if I had overemphasized the proto-Nincendi aspects of my project. Perhaps highlighting the broader applications of my research would have been wiser. Nonetheless, I believed I addressed Dr. Harrison’s query effectively.'
      ).find((entity) => entity.surface === 'Dr. Harrison')?.detectionReason
    ).toBe('titled_name');
  });

  it('keeps unicode hyphenated titled names as one candidate', () => {
    const entities = entityRefsFor(
      'The reply from Dr. Müller-Sarkisian arrived after lunch.',
      [],
      'import'
    );
    const surfaces = entities.map((entity) => entity.surface);

    expect(surfaces).toContain('Dr. Müller-Sarkisian');
    expect(surfaces).not.toContain('Müller-Sarkisian');
    expect(surfaces).not.toContain('Sarkisian');
    expect(
      entities.find((entity) => entity.surface === 'Dr. Müller-Sarkisian')
        ?.detectionReason
    ).toBe('titled_name');
  });

  it('does not widen an unknown candidate to include a lowercase boundary word', () => {
    const surfaces = surfacesFor(
      "The overpowering smell of a clove cigarette that Johnson must have smoked just before the meeting lingered in my mind."
    );

    expect(surfaces).not.toContain('that Johnson');
    expect(surfaces).not.toContain('cigarette that Johnson');
  });

  it('is conservative with one-off multiword candidates during import', () => {
    const surfaces = surfacesFor(
      'The Internal Review took longer than expected. Mira entered the Ember Archive before dawn.',
      [],
      'import'
    );

    expect(surfaces).not.toContain('Internal Review');
    expect(surfaces).toContain('Ember Archive');
    expect(
      entityRefsFor(
        'The Internal Review took longer than expected. Mira entered the Ember Archive before dawn.',
        [],
        'import'
      ).find((entity) => entity.surface === 'Ember Archive')?.detectionReason
    ).toBe('leading_entity_cue');
  });

  it('suppresses normal sentence-start phrase fragments during import', () => {
    const surfaces = surfacesFor(
      'Typical Loa behavior was absent from the meeting. Despite Harlow arriving late, the committee continued.',
      [],
      'import'
    );

    expect(surfaces).not.toContain('Typical Loa');
    expect(surfaces).not.toContain('Despite Harlow');
  });

  it('suppresses common sentence-start words that otherwise highlight every instance', () => {
    const surfaces = surfacesFor(
      "Look at the notes again. Some of the conclusions don't apply. I don't think the old look matters.",
      [],
      'import'
    );

    expect(surfaces).not.toContain('Look');
    expect(surfaces).not.toContain('Some');
    expect(surfaces).not.toContain("Don");
    expect(surfaces).not.toContain("Don't");
  });

  it('records repeated unknowns as the detection reason', () => {
    const entity = entityRefsFor(
      'Kaelor crossed the harbor. Kaelor returned before dawn.',
      [],
      'import'
    ).find((entry) => entry.surface === 'Kaelor');

    expect(entity?.detectionReason).toBe('repeated_unknown');
  });

  it('keeps likely one-off character names without reopening generic sentence starts', () => {
    const entities = entityRefsFor(
      "Kael fought against the mad rabbit for his life. Zippy could feel depression coming on. It was Kaelor's fault.",
      [],
      'import'
    );
    const surfaces = entities.map((entity) => entity.surface);

    expect(surfaces).toContain('Kael');
    expect(surfaces).toContain('Zippy');
    expect(surfaces).toContain("Kaelor's");
    expect(
      entities.find((entity) => entity.surface === 'Kael')?.detectionReason
    ).toBe('character_context_candidate');
    expect(
      entities.find((entity) => entity.surface === 'Zippy')?.detectionReason
    ).toBe('character_context_candidate');
    expect(
      entities.find((entity) => entity.surface === "Kaelor's")
        ?.detectionReason
    ).toBe('character_context_candidate');
  });

  it('keeps one-off character names when the sentence opens with an emotional action', () => {
    const entities = entityRefsFor(
      'Kael hated the dungeon. All he wanted was to curl up with a good book.',
      [],
      'workspace-save'
    );

    expect(entities.map((entity) => entity.surface)).toContain('Kael');
    expect(
      entities.find((entity) => entity.surface === 'Kael')?.detectionReason
    ).toBe('character_context_candidate');
  });

  it('keeps one-off character names used in direct-address dialogue', () => {
    const entities = entityRefsFor(
      '"Kaelor, get your head in the game!" Blatnor shouted.',
      [],
      'workspace-autosave'
    );

    expect(entities.map((entity) => entity.surface)).toContain('Kaelor');
    expect(entities.map((entity) => entity.surface)).toContain('Blatnor');
    expect(
      entities.find((entity) => entity.surface === 'Kaelor')?.detectionReason
    ).toBe('character_context_candidate');
  });

  it('treats one-off hyphenated nicknames as multi-part unknowns during workspace review', () => {
    const entities = entityRefsFor(
      'Lantern-Mira checked the Warrens gate alone.',
      [],
      'workspace-autosave'
    );

    expect(entities.map((entity) => entity.surface)).toContain('Lantern-Mira');
    expect(
      entities.find((entity) => entity.surface === 'Lantern-Mira')?.detectionReason
    ).toBe('multiword_proper_candidate');
  });

  it('does not report an in-progress prefix of a known multiword entity', () => {
    const surfaces = surfacesFor(
      'Zippy could see the Ember Archiv from the road.',
      [{id: 'entity-1', name: 'Ember Archive', type: 'entity'}],
      'workspace-autosave'
    );

    expect(surfaces).toContain('Zippy');
    expect(surfaces).not.toContain('Ember Archiv');
  });

  it('does not treat ambiguous stat progression prose as a canon entity', () => {
    const surfaces = surfacesFor(
      'He felt his marrow burn with newfound strength.'
    );

    expect(surfaces).not.toContain('He');
    expect(surfaces).not.toContain('strength');
  });

  it('treats full names, hyphenated nicknames, and short aliases as known when provided', () => {
    const entities = entityRefsFor(
      'Mira Voss slipped into the Iron Warrens while Lantern-Mira checked the Warrens gate. Mira returned at dusk.',
      [
        {id: 'character-1', name: 'Mira Voss', type: 'character'},
        {id: 'character-1', name: 'Mira', type: 'character'},
        {id: 'character-1', name: 'Lantern-Mira', type: 'character'},
        {id: 'entity-1', name: 'Iron Warrens', type: 'entity'},
        {id: 'entity-1', name: 'Warrens', type: 'entity'}
      ],
      'workspace-autosave'
    );

    expect(
      entities.map((entity) => [entity.surface, entity.entityId, entity.detectionReason])
    ).toEqual([
      ['Mira Voss', 'character-1', 'known_entity'],
      ['Iron Warrens', 'entity-1', 'known_entity'],
      ['Lantern-Mira', 'character-1', 'known_entity'],
      ['Warrens', 'entity-1', 'known_entity'],
      ['Mira', 'character-1', 'known_entity']
    ]);
  });

  it('does not mark linked exact-name character and world bible records as ambiguous', () => {
    const entities = entityRefsFor(
      '"Kaelor, get your head in the game!" Blatnor shouted. Kael thought to himself, "no."',
      [
        {id: 'entity-kael', name: 'Kael', type: 'entity'},
        {id: 'character-kael', name: 'Kael', type: 'character'}
      ],
      'workspace-autosave'
    );

    const kael = entities.find((entity) => entity.surface === 'Kael');

    expect(kael?.detectionReason).toBe('known_entity');
    expect(kael?.candidateEntities).toBeUndefined();
    expect(entities.map((entity) => entity.surface)).toEqual([
      'Kaelor',
      'Blatnor',
      'Kael'
    ]);
  });
});
