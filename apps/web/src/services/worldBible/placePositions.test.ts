import {describe, expect, it} from 'vitest';
import type {EntityCategory, StateMutationEvent, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage/repositories/aliasStorage';
import {
  buildPlaceNameIndex,
  findUnlinkedPlaceNames,
  keepManualPlaceLinks,
  linkEventPlaces,
  linkPlaceName,
  linkUnlinkedPositions,
  matchPlaceId,
  normalizePlaceName,
  positionLabel
} from './placePositions';

const categories: EntityCategory[] = [
  {id: 'cat-loc', projectId: 'p', kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 0},
  {id: 'cat-char', projectId: 'p', kind: 'general', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 0}
];

const record = (id: string, name: string, categoryId = 'cat-loc'): WorldEntity => ({
  id, projectId: 'p', categoryId, name, fields: {}, links: [], createdAt: 0, updatedAt: 0
});

const alias = (entityId: string, text: string): ConsistencyAlias => ({
  id: `alias-${text}`, projectId: 'p', targetId: entityId, targetType: 'entity', entityId,
  alias: text, createdAt: 0, updatedAt: 0
});

const move = (
  id: string,
  locationName: string,
  extra: {placeId?: string; status?: StateMutationEvent['status']} = {}
): StateMutationEvent => ({
  id,
  projectId: 'p',
  sceneId: `scene-${id}`,
  sourceRevision: 1,
  sourceHash: 'h',
  status: extra.status ?? 'accepted',
  commands: [{type: 'location_set', actorId: 'entity-sera', locationName, placeId: extra.placeId}],
  createdAt: 0
});

const index = buildPlaceNameIndex({
  categories,
  entities: [
    record('archive', 'Ember Archive'),
    record('north-gate', 'North Gate'),
    record('north-gate-2', 'North Gate'),
    record('sera', 'Sera', 'cat-char')
  ],
  aliases: [alias('archive', 'the Archive'), alias('sera', 'Highmoor')]
});

describe('place name matching', () => {
  it('ignores case, punctuation, and a leading "the"', () => {
    expect(normalizePlaceName('The Ember-Archive!')).toBe('ember archive');
    expect(matchPlaceId('ember archive', index)).toBe('archive');
  });

  it('matches by alias', () => {
    expect(matchPlaceId('Archive', index)).toBe('archive');
  });

  it('refuses ambiguous names, unknown names, and aliases of non-place records', () => {
    expect(matchPlaceId('North Gate', index)).toBeNull();
    expect(matchPlaceId('Old Mill', index)).toBeNull();
    expect(matchPlaceId('Highmoor', index)).toBeNull();
  });
});

describe('one-time matching', () => {
  it('links unambiguous names and leaves everything else as text', () => {
    const events = [
      move('a', 'the Archive'),
      move('b', 'North Gate'),
      move('c', 'Old Mill'),
      move('d', 'Ember Archive', {placeId: 'archive'})
    ];
    const changed = linkUnlinkedPositions(events, index);
    expect(changed.map((event) => event.id)).toEqual(['a']);
    expect(changed[0].commands[0]).toMatchObject({locationName: 'the Archive', placeId: 'archive'});
  });

  it('returns the same event when nothing links', () => {
    const event = move('c', 'Old Mill');
    expect(linkEventPlaces(event, index)).toBe(event);
  });
});

describe('keeping a manual link through an edit', () => {
  it('keeps the link while the name is unchanged, and drops it when renamed', () => {
    const previous = move('a', 'old mill', {placeId: 'archive'});
    expect(keepManualPlaceLinks(move('a', 'Old Mill'), previous).commands[0])
      .toMatchObject({placeId: 'archive'});
    expect(keepManualPlaceLinks(move('a', 'Highmoor'), previous).commands[0])
      .not.toHaveProperty('placeId', 'archive');
  });
});

describe('the review queue', () => {
  const events = [
    move('a', 'Old Mill'),
    move('b', 'old mill'),
    move('c', 'Old Mill'),
    move('d', 'North Gate'),
    move('e', 'Ember Archive', {placeId: 'archive'}),
    move('f', 'Lost Place', {placeId: 'deleted-record'}),
    move('g', 'Gone', {status: 'invalidated'})
  ];

  it('groups unlinked names, most used first, with candidates for ambiguous ones', () => {
    const queue = findUnlinkedPlaceNames({events, index});
    expect(queue.map((item) => [item.key, item.name, item.positionCount])).toEqual([
      ['old mill', 'Old Mill', 3],
      ['lost place', 'Lost Place', 1],
      ['north gate', 'North Gate', 1]
    ]);
    expect(queue.find((item) => item.key === 'north gate')?.candidateIds.sort())
      .toEqual(['north-gate', 'north-gate-2']);
  });

  it('leaves out names kept as text', () => {
    expect(findUnlinkedPlaceNames({events, index, keptAsText: ['old mill']}).map((item) => item.key))
      .not.toContain('old mill');
  });

  it('links every unlinked position with that name, and none already linked elsewhere', () => {
    const changed = linkPlaceName({
      events: [...events, move('h', 'Old Mill', {placeId: 'north-gate'})],
      key: 'old mill',
      placeId: 'archive',
      places: index.places
    });
    expect(changed.map((event) => event.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('position labels', () => {
  it("shows the place's current name, falling back to the written text", () => {
    expect(positionLabel({locationName: 'the Archive', locationPlaceId: 'archive'}, index.places))
      .toBe('Ember Archive');
    expect(positionLabel({locationName: 'Lost Place', locationPlaceId: 'deleted-record'}, index.places))
      .toBe('Lost Place');
    expect(positionLabel({locationName: 'Old Mill'}, index.places)).toBe('Old Mill');
  });
});
