import type {
  EntityCategory,
  StateMutationCommand,
  StateMutationEvent,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {placesById, type PlacesById} from './places';

/*
 * Positions refer to place records (slice 4.77, places brief § 3).
 *
 * A `location_set` command may carry the id of the World Bible place it
 * means. The typed name stays as the label and as the fallback when there is
 * no record. A name links to a record only when it matches exactly one place,
 * by name or alias; anything else stays text and is offered for review.
 * Nothing here guesses between candidates.
 */

/** "The Ember Archive", "ember archive", and "Ember-Archive" compare equal. */
export const normalizePlaceName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');

export interface PlaceNameIndex {
  places: PlacesById;
  /** Normalized name or alias → the place ids it could mean. */
  idsByName: ReadonlyMap<string, ReadonlySet<string>>;
}

export const buildPlaceNameIndex = (params: {
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
}): PlaceNameIndex => {
  const places = placesById(params.categories, params.entities);
  const idsByName = new Map<string, Set<string>>();
  const add = (name: string, placeId: string) => {
    const key = normalizePlaceName(name);
    if (!key) return;
    const ids = idsByName.get(key) ?? new Set<string>();
    ids.add(placeId);
    idsByName.set(key, ids);
  };
  places.forEach((place) => add(place.name, place.id));
  params.aliases.forEach((alias) => {
    const placeId = alias.targetType === 'entity' ? alias.entityId ?? alias.targetId : null;
    if (placeId && places.has(placeId)) add(alias.alias, placeId);
  });
  return {places, idsByName};
};

/** The place ids a name could mean (none, one, or several). */
export const placeCandidates = (name: string, index: PlaceNameIndex): string[] =>
  [...(index.idsByName.get(normalizePlaceName(name)) ?? [])];

/** The one place a name means, or null when it matches none or several. */
export const matchPlaceId = (name: string, index: PlaceNameIndex): string | null => {
  const candidates = placeCandidates(name, index);
  return candidates.length === 1 ? candidates[0] : null;
};

/** True when the command's place id points at a place that still exists. */
const hasLivePlace = (
  command: Extract<StateMutationCommand, {type: 'location_set'}>,
  index: PlaceNameIndex
): boolean => Boolean(command.placeId && index.places.has(command.placeId));

/**
 * Gives each `location_set` without a place id the one place its name means.
 * Commands that already have one, or whose name is unmatched or ambiguous,
 * are left alone. Returns the same event when nothing changed.
 */
export const linkEventPlaces = (
  event: StateMutationEvent,
  index: PlaceNameIndex
): StateMutationEvent => {
  let changed = false;
  const commands = event.commands.map((command) => {
    if (command.type !== 'location_set' || command.placeId) return command;
    const placeId = matchPlaceId(command.locationName, index);
    if (!placeId) return command;
    changed = true;
    return {...command, placeId};
  });
  return changed ? {...event, commands} : event;
};

/** The events the one-time matching changes. */
export const linkUnlinkedPositions = (
  events: StateMutationEvent[],
  index: PlaceNameIndex
): StateMutationEvent[] =>
  events.flatMap((event) => {
    const linked = linkEventPlaces(event, index);
    return linked === event ? [] : [linked];
  });

/**
 * Keeps a manual link when an edited command still names the same place.
 * Forms rebuild commands from the typed name, so an author's earlier choice
 * would otherwise be lost on every edit.
 */
export const keepManualPlaceLinks = (
  event: StateMutationEvent,
  previous: StateMutationEvent | null | undefined
): StateMutationEvent => {
  if (!previous) return event;
  let changed = false;
  const commands = event.commands.map((command, index) => {
    const before = previous.commands[index];
    if (
      command.type !== 'location_set' ||
      command.placeId ||
      before?.type !== 'location_set' ||
      !before.placeId ||
      normalizePlaceName(before.locationName) !== normalizePlaceName(command.locationName)
    ) {
      return command;
    }
    changed = true;
    return {...command, placeId: before.placeId};
  });
  return changed ? {...event, commands} : event;
};

export interface UnlinkedPlaceName {
  /** Normalized name; the review queue's key. */
  key: string;
  /** The name as most often written. */
  name: string;
  eventIds: string[];
  positionCount: number;
  /** Places the name could mean, when it matches several. */
  candidateIds: string[];
}

/**
 * Position names that refer to no place record, grouped by name, most used
 * first. Accepted and pending entries count; invalidated ones do not. Names
 * the author chose to keep as text are left out.
 */
export const findUnlinkedPlaceNames = (params: {
  events: StateMutationEvent[];
  index: PlaceNameIndex;
  keptAsText?: string[];
}): UnlinkedPlaceName[] => {
  const kept = new Set(params.keptAsText ?? []);
  const groups = new Map<string, {spellings: Map<string, number>; eventIds: Set<string>; count: number}>();
  params.events
    .filter((event) => event.status !== 'invalidated')
    .forEach((event) => {
      event.commands.forEach((command) => {
        if (command.type !== 'location_set' || hasLivePlace(command, params.index)) return;
        const key = normalizePlaceName(command.locationName);
        if (!key || kept.has(key)) return;
        const group = groups.get(key) ?? {spellings: new Map(), eventIds: new Set(), count: 0};
        const spelling = command.locationName.trim();
        group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
        group.eventIds.add(event.id);
        group.count += 1;
        groups.set(key, group);
      });
    });
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      name: [...group.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      eventIds: [...group.eventIds],
      positionCount: group.count,
      candidateIds: placeCandidates(key, params.index)
    }))
    .sort((a, b) => b.positionCount - a.positionCount || a.name.localeCompare(b.name));
};

/**
 * Links every unlinked position written as `key` to `placeId`: the author's
 * choice from the review queue. Positions already linked to a place that
 * still exists keep their link. Returns only the events that changed.
 */
export const linkPlaceName = (params: {
  events: StateMutationEvent[];
  key: string;
  placeId: string;
  places: PlacesById;
}): StateMutationEvent[] =>
  params.events.flatMap((event) => {
    let changed = false;
    const commands = event.commands.map((command) => {
      if (
        command.type !== 'location_set' ||
        (command.placeId && params.places.has(command.placeId)) ||
        normalizePlaceName(command.locationName) !== params.key
      ) {
        return command;
      }
      changed = true;
      return {...command, placeId: params.placeId};
    });
    return changed ? [{...event, commands}] : [];
  });

/** Place record names, for suggesting while the author types a position. */
export const placeNameSuggestions = (categories: EntityCategory[], entities: WorldEntity[]): string[] =>
  [...new Set([...placesById(categories, entities).values()].map((place) => place.name))]
    .sort((a, b) => a.localeCompare(b));

/** The place's current name when the position links to one, else the text the author wrote. */
export const positionLabel = (
  position: {locationName?: string; locationPlaceId?: string},
  places: PlacesById
): string | undefined =>
  (position.locationPlaceId ? places.get(position.locationPlaceId)?.name : undefined) ??
  position.locationName;
