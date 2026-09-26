import type {
  CharacterSheet,
  CompendiumEntry,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {
  type CharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue
} from '../compendium';
import {sortWritingDocuments} from '../../writingStorage';
import {findConsumableEntry} from './consumableEffects';
import {replayCharacterState} from './stateReplay';

export interface CharacterSnapshotStatLine {
  id: string;
  label: string;
  value: string;
}

export interface CharacterSnapshotResourceLine {
  id: string;
  label: string;
  current: number;
  max?: number;
}

export interface CharacterSnapshotInventoryLine {
  name: string;
  quantity: number;
  equipped: boolean;
  definitionId?: string;
  consumable?: {
    definitionId: string;
    durationLabel?: string;
  };
}

/** Read-only, display-ready state for one sheet-backed character at a point in the manuscript. */
export interface CharacterSnapshot {
  sheetId: string;
  name: string;
  level: number;
  stats: CharacterSnapshotStatLine[];
  resources: CharacterSnapshotResourceLine[];
  inventory: CharacterSnapshotInventoryLine[];
  statuses: string[];
  location?: string;
}

export type CharacterSnapshotMoment = 'opening' | 'cursor' | 'ending';

/**
 * Where in the manuscript to read state. `sceneOrder` is the 1-based position of
 * the scene in manuscript order (see `getSceneOrder`); `latest` applies every
 * accepted event.
 */
export type CharacterSnapshotPosition =
  | {kind: 'latest'}
  | {
      kind: 'scene';
      sceneOrder: number;
      moment: CharacterSnapshotMoment;
      cursorPosition?: number;
    };

/** 1-based manuscript order of a scene, or 0 when it is not in the manuscript. */
export function getSceneOrder(documents: WritingDocument[], sceneId: string): number {
  return sortWritingDocuments(documents).findIndex((document) => document.id === sceneId) + 1;
}

const replayCutoff = (
  position: CharacterSnapshotPosition
): {upToSceneOrder?: number; upToScenePosition?: number} => {
  if (position.kind === 'latest') return {};
  return {
    upToSceneOrder:
      position.moment === 'opening'
        ? Math.max(0, position.sceneOrder - 1)
        : position.sceneOrder,
    upToScenePosition: position.moment === 'cursor' ? position.cursorPosition : undefined
  };
};

export function buildCharacterSnapshot(params: {
  sheet: CharacterSheet;
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  actorResolutions?: ActorResolution[];
  position: CharacterSnapshotPosition;
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  compendiumEntries: CompendiumEntry[];
  entityById: ReadonlyMap<string, WorldEntity>;
}): CharacterSnapshot {
  const {sheet, runtimeModifiers} = params;
  const replayed = replayCharacterState({
    sheet,
    ruleset: params.ruleset,
    events: params.events,
    target: {
      actorId: sheet.characterEntityId,
      characterId: sheet.characterId,
      sheetId: sheet.id,
      actorName: sheet.name
    },
    actorResolutions: params.actorResolutions,
    ...replayCutoff(params.position)
  });

  return {
    sheetId: sheet.id,
    name: sheet.name,
    level: Math.max(1, sheet.level + runtimeModifiers.levelBonus),
    stats: Object.entries(replayed.stats).map(([id, value]) => ({
      id,
      label: params.statDefinitionNameById.get(id) ?? id,
      value:
        typeof value === 'number'
          ? String(
              getEffectiveStatValue({
                definitionId: id,
                baseValue: value,
                runtime: runtimeModifiers
              })
            )
          : String(value)
    })),
    resources: Object.entries(replayed.resources.current).map(([id, current]) => {
      const effective = getEffectiveResourceValues({
        definitionId: id,
        current,
        max: replayed.resources.max[id] ?? current,
        runtime: runtimeModifiers
      });
      return {
        id,
        label: params.resourceDefinitionNameById.get(id) ?? id,
        current: effective.current,
        max: effective.max
      };
    }),
    inventory: replayed.inventory.items.map((item) => {
      const linkedEntry = item.definitionId
        ? params.compendiumEntries.find((entry) => entry.id === item.definitionId) ?? null
        : null;
      const linkedEntityId = item.sourceEntityId ?? linkedEntry?.sourceEntityId;
      const linkedEntity = linkedEntityId ? params.entityById.get(linkedEntityId) ?? null : null;
      const resolvedItem = {
        ...item,
        name: linkedEntity?.name ?? linkedEntry?.name ?? item.name
      };
      const consumableEntry = findConsumableEntry({
        entries: params.compendiumEntries,
        item: resolvedItem
      });
      return {
        ...resolvedItem,
        equipped: replayed.inventory.equipped.some(
          (name) => name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase()
        ),
        consumable: consumableEntry?.consumable
          ? {
              definitionId: consumableEntry.id,
              durationLabel: consumableEntry.consumable.durationLabel
            }
          : undefined
      };
    }),
    statuses: Array.from(new Set([...replayed.statuses, ...runtimeModifiers.notes])),
    location: replayed.locationName
  };
}

export type CharacterSnapshotChange =
  | {kind: 'level'; from: number; to: number}
  | {kind: 'stat'; id: string; label: string; from: string | null; to: string | null}
  | {
      kind: 'resource';
      id: string;
      label: string;
      from: {current: number; max?: number} | null;
      to: {current: number; max?: number} | null;
    }
  | {kind: 'status'; name: string; change: 'added' | 'removed'}
  | {kind: 'item'; name: string; fromQuantity: number; toQuantity: number}
  | {kind: 'equipment'; name: string; change: 'equipped' | 'unequipped'}
  | {kind: 'location'; from: string | null; to: string | null};

const itemKey = (name: string): string => name.trim().toLocaleLowerCase();

/**
 * What differs between two snapshots of the same character, e.g. the previous
 * scene's ending and the current cursor. Ordered: level, resources, stats,
 * statuses, inventory, equipment, location.
 */
export function describeCharacterSnapshotChanges(
  before: CharacterSnapshot,
  after: CharacterSnapshot
): CharacterSnapshotChange[] {
  const changes: CharacterSnapshotChange[] = [];

  if (before.level !== after.level) {
    changes.push({kind: 'level', from: before.level, to: after.level});
  }

  const beforeResources = new Map(before.resources.map((resource) => [resource.id, resource]));
  const afterResources = new Map(after.resources.map((resource) => [resource.id, resource]));
  new Set([...beforeResources.keys(), ...afterResources.keys()]).forEach((id) => {
    const from = beforeResources.get(id) ?? null;
    const to = afterResources.get(id) ?? null;
    if (from?.current === to?.current && from?.max === to?.max) return;
    changes.push({
      kind: 'resource',
      id,
      label: (to ?? from)?.label ?? id,
      from: from ? {current: from.current, max: from.max} : null,
      to: to ? {current: to.current, max: to.max} : null
    });
  });

  const beforeStats = new Map(before.stats.map((stat) => [stat.id, stat]));
  const afterStats = new Map(after.stats.map((stat) => [stat.id, stat]));
  new Set([...beforeStats.keys(), ...afterStats.keys()]).forEach((id) => {
    const from = beforeStats.get(id) ?? null;
    const to = afterStats.get(id) ?? null;
    if (from?.value === to?.value) return;
    changes.push({
      kind: 'stat',
      id,
      label: (to ?? from)?.label ?? id,
      from: from?.value ?? null,
      to: to?.value ?? null
    });
  });

  const beforeStatuses = new Set(before.statuses);
  const afterStatuses = new Set(after.statuses);
  after.statuses.forEach((name) => {
    if (!beforeStatuses.has(name)) changes.push({kind: 'status', name, change: 'added'});
  });
  before.statuses.forEach((name) => {
    if (!afterStatuses.has(name)) changes.push({kind: 'status', name, change: 'removed'});
  });

  const quantities = (snapshot: CharacterSnapshot) => {
    const byKey = new Map<string, {name: string; quantity: number; equipped: boolean}>();
    snapshot.inventory.forEach((item) => {
      const key = itemKey(item.name);
      const existing = byKey.get(key);
      byKey.set(key, {
        name: existing?.name ?? item.name,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        equipped: Boolean(existing?.equipped) || item.equipped
      });
    });
    return byKey;
  };
  const beforeItems = quantities(before);
  const afterItems = quantities(after);
  const itemKeys = new Set([...beforeItems.keys(), ...afterItems.keys()]);
  itemKeys.forEach((key) => {
    const from = beforeItems.get(key);
    const to = afterItems.get(key);
    const fromQuantity = from?.quantity ?? 0;
    const toQuantity = to?.quantity ?? 0;
    if (fromQuantity !== toQuantity) {
      changes.push({
        kind: 'item',
        name: (to ?? from)?.name ?? key,
        fromQuantity,
        toQuantity
      });
    }
  });
  itemKeys.forEach((key) => {
    const wasEquipped = Boolean(beforeItems.get(key)?.equipped);
    const isEquipped = Boolean(afterItems.get(key)?.equipped);
    if (wasEquipped === isEquipped) return;
    changes.push({
      kind: 'equipment',
      name: (afterItems.get(key) ?? beforeItems.get(key))?.name ?? key,
      change: isEquipped ? 'equipped' : 'unequipped'
    });
  });

  if ((before.location ?? null) !== (after.location ?? null)) {
    changes.push({kind: 'location', from: before.location ?? null, to: after.location ?? null});
  }

  return changes;
}

/** One-line summaries for compact surfaces such as the editor's hover card. */
export function summarizeCharacterSnapshot(
  snapshot: CharacterSnapshot,
  limit = 4
): {resources: string[]; stats: string[]; statuses: string[]; location?: string} {
  return {
    resources: snapshot.resources
      .slice(0, limit)
      .map((resource) => `${resource.label} ${resource.current}/${resource.max}`),
    stats: snapshot.stats.slice(0, limit).map((stat) => `${stat.label} ${stat.value}`),
    statuses: snapshot.statuses,
    location: snapshot.location
  };
}
