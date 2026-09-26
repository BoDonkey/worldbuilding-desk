import type {
  CharacterSheet,
  StatBlockPreferences,
  StatBlockStyle,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {findTextMatches, normalizeCanonText} from '../consistency/textMatcher';
import type {CharacterSnapshot} from './characterSnapshot';

/** A sheet-backed character the stat peek can open, with every name the prose may use. */
export interface CharacterPeekTarget {
  sheetId: string;
  name: string;
  entityId?: string;
  characterId?: string;
  surfaces: string[];
}

/**
 * One target per sheet. Surfaces are the sheet name, the linked World Bible
 * entry's name, and that entry's aliases.
 */
export function buildCharacterPeekTargets(params: {
  sheets: CharacterSheet[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
}): CharacterPeekTarget[] {
  const entityById = new Map(params.entities.map((entity) => [entity.id, entity]));
  return params.sheets.map((sheet) => {
    const entity = sheet.characterEntityId ? entityById.get(sheet.characterEntityId) : undefined;
    // Legacy character-targeted aliases count until the Workspace migrates them.
    const aliasSurfaces = params.aliases
      .filter((alias) =>
        (alias.targetType ?? 'entity') === 'entity'
          ? Boolean(entity) && alias.targetId === entity?.id
          : Boolean(sheet.characterId) && alias.targetId === sheet.characterId
      )
      .map((alias) => alias.alias);
    const surfaces: string[] = [];
    const seen = new Set<string>();
    [sheet.name, entity?.name, ...aliasSurfaces].forEach((surface) => {
      const normalized = surface ? normalizeCanonText(surface) : '';
      if (!surface || !normalized || seen.has(normalized)) return;
      seen.add(normalized);
      surfaces.push(surface.trim());
    });
    return {
      sheetId: sheet.id,
      name: sheet.name,
      entityId: sheet.characterEntityId,
      characterId: sheet.characterId,
      surfaces
    };
  });
}

/**
 * Characters named at a cursor or selection inside one block of text, using
 * the same exact matching as the editor's highlights. A collapsed cursor
 * touching either end of a name counts. More than one result means the name is
 * shared and the author must choose.
 */
export function findCharacterPeekTargetsAt(params: {
  text: string;
  from: number;
  to: number;
  targets: CharacterPeekTarget[];
}): CharacterPeekTarget[] {
  const sheetIdsBySurface = new Map<string, {surface: string; sheetIds: string[]}>();
  params.targets.forEach((target) => {
    target.surfaces.forEach((surface) => {
      const normalized = normalizeCanonText(surface);
      const entry = sheetIdsBySurface.get(normalized) ?? {surface, sheetIds: []};
      if (!entry.sheetIds.includes(target.sheetId)) entry.sheetIds.push(target.sheetId);
      sheetIdsBySurface.set(normalized, entry);
    });
  });

  const matches = findTextMatches(
    params.text,
    Array.from(sheetIdsBySurface.entries()).map(([normalized, entry]) => ({
      id: normalized,
      surface: entry.surface,
      kind: 'known' as const,
      metadata: {sheetIds: entry.sheetIds}
    }))
  );
  const isCollapsed = params.from === params.to;
  const sheetIds: string[] = [];
  matches
    .filter((match) =>
      isCollapsed
        ? match.from <= params.from && params.from <= match.to
        : match.from < params.to && params.from < match.to
    )
    .forEach((match) => {
      (match.pattern.metadata?.sheetIds as string[]).forEach((sheetId) => {
        if (!sheetIds.includes(sheetId)) sheetIds.push(sheetId);
      });
    });
  return sheetIds
    .map((sheetId) => params.targets.find((target) => target.sheetId === sheetId))
    .filter((target): target is CharacterPeekTarget => Boolean(target));
}

/** The target behind a highlighted World Bible mention (the editor's lore id). */
export function findCharacterPeekTargetForLore(
  targets: CharacterPeekTarget[],
  loreId: string
): CharacterPeekTarget | null {
  return (
    targets.find(
      (target) =>
        target.sheetId === loreId || target.characterId === loreId || target.entityId === loreId
    ) ?? null
  );
}

/** Name and alias search for the command palette's character picker. */
export function searchCharacterPeekTargets(
  targets: CharacterPeekTarget[],
  query: string
): CharacterPeekTarget[] {
  const term = query.trim().toLocaleLowerCase();
  const sorted = targets
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
  if (!term) return sorted;
  return sorted.filter((target) =>
    target.surfaces.some((surface) => surface.toLocaleLowerCase().includes(term))
  );
}

/**
 * The project's stat-block template as it applies to the stat card: the same
 * style label and stat/resource scope that inserted status windows use.
 */
export interface CharacterStatCardTemplate {
  style: StatBlockStyle;
  label: string;
  statIds?: string[];
  resourceIds?: string[];
}

const STYLE_LABELS: Record<StatBlockStyle, string> = {
  full: 'All Stats',
  buffs: 'Buffs Only',
  compact: 'Compact'
};

export function resolveCharacterStatCardTemplate(
  preferences: StatBlockPreferences | null | undefined
): CharacterStatCardTemplate | undefined {
  if (!preferences) return undefined;
  const style = preferences.style ?? 'full';
  const base = {style, label: `Character Status • ${STYLE_LABELS[style] ?? STYLE_LABELS.full}`};
  const scope = preferences.scopePreset ?? 'all';
  if (scope === 'stats') return {...base, resourceIds: []};
  if (scope === 'resources') return {...base, statIds: []};
  if (scope === 'custom') {
    const group = preferences.selectedGroupId
      ? preferences.groups?.find((entry) => entry.id === preferences.selectedGroupId)
      : undefined;
    return {
      ...base,
      statIds: group?.statIds ?? preferences.selectedStatIds ?? [],
      resourceIds: group?.resourceIds ?? preferences.selectedResourceIds ?? []
    };
  }
  return base;
}

/** Restricts a snapshot to the template's stat and resource scope. */
export function applyCharacterStatCardTemplate(
  snapshot: CharacterSnapshot,
  template: CharacterStatCardTemplate | undefined
): CharacterSnapshot {
  if (!template) return snapshot;
  const statIds = template.statIds ? new Set(template.statIds) : null;
  const resourceIds = template.resourceIds ? new Set(template.resourceIds) : null;
  return {
    ...snapshot,
    stats: statIds ? snapshot.stats.filter((stat) => statIds.has(stat.id)) : snapshot.stats,
    resources: resourceIds
      ? snapshot.resources.filter((resource) => resourceIds.has(resource.id))
      : snapshot.resources
  };
}
