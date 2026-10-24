import type {
  CharacterSheet,
  ProjectSettings,
  StatBlockGroup,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  WorldEntity
} from '../../entityTypes';
import type {CharacterRuntimeModifiers} from '../compendium';
import {
  buildCharacterStatBlockHtml,
  buildItemStatBlockHtml,
  createStatBlockToken,
  formatEntityFieldValue,
  getDefaultStatBlockTokenPresentation,
  getStatBlockStyleLabel,
  getStatBlockTokenDisplayLabel,
  parseStatBlockToken,
  replaceFirstStatBlockTokenInHtml
} from '../../utils/statBlockTemplates';
import type {ParsedStatBlockToken, StatBlockTokenPresentation} from '../../utils/statBlockTemplates';

/*
 * Pure stat-block logic for the Workspace (3.22): selection scope, source
 * resolution, rendering inputs, and token status text. Moved verbatim from
 * useWorkspaceStatBlocks, which keeps the React state and side effects.
 */

export interface StatBlockPreviewData {
  rawToken: string;
  title: string;
  sourceType: StatBlockSourceType;
  style: StatBlockStyle;
  status: 'resolved' | 'ambiguous' | 'missing' | 'invalid';
  message: string;
  html: string | null;
  requiresRebind: boolean;
}

export interface StatBlockSelection {
  selectedStatIds?: string[];
  selectedResourceIds?: string[];
}

export type StatBlockTokenMatch =
  | {status: 'resolved'; label: string; matchName: string; candidates: string[]}
  | {status: 'ambiguous'; label: string; candidates: string[]}
  | {status: 'missing'; label: string; candidates: string[]};

export type StatBlockPreferences = NonNullable<ProjectSettings['statBlockPreferences']>;

export interface StatBlockPreferenceInput {
  sourceType: StatBlockSourceType;
  style: StatBlockStyle;
  insertMode: StatBlockInsertMode;
  scopePreset: StatBlockScopePreset;
  selectedGroupId: string;
  selectedStatIds: string[];
  selectedResourceIds: string[];
  groups: StatBlockGroup[];
}

/** True when the saved preferences already match the current selections. */
export const statBlockPreferencesMatch = (
  currentPrefs: ProjectSettings['statBlockPreferences'],
  next: StatBlockPreferenceInput
): boolean =>
  currentPrefs?.sourceType === next.sourceType &&
  currentPrefs?.style === next.style &&
  currentPrefs?.insertMode === next.insertMode &&
  currentPrefs?.scopePreset === next.scopePreset &&
  (currentPrefs?.selectedGroupId ?? '') === next.selectedGroupId &&
  JSON.stringify(currentPrefs?.groups ?? []) === JSON.stringify(next.groups) &&
  JSON.stringify(currentPrefs?.selectedStatIds ?? []) === JSON.stringify(next.selectedStatIds) &&
  JSON.stringify(currentPrefs?.selectedResourceIds ?? []) === JSON.stringify(next.selectedResourceIds);

export const buildStatBlockPreferences = (next: StatBlockPreferenceInput): StatBlockPreferences => ({
  sourceType: next.sourceType,
  style: next.style,
  insertMode: next.insertMode,
  scopePreset: next.scopePreset,
  selectedGroupId: next.selectedGroupId,
  selectedStatIds: [...next.selectedStatIds],
  selectedResourceIds: [...next.selectedResourceIds],
  groups: next.groups
});

/** Which stats and resources a character block shows; `undefined` means all of them. */
export const resolveCharacterSelection = (params: {
  scopePreset: StatBlockScopePreset;
  availableStatIds: string[];
  availableResourceIds: string[];
  selectedGroup: StatBlockGroup | null;
  selectedStatIds: string[];
  selectedResourceIds: string[];
}): StatBlockSelection => {
  const {scopePreset, availableStatIds, availableResourceIds, selectedGroup, selectedStatIds, selectedResourceIds} = params;
  const availableStatIdSet = new Set(availableStatIds);
  const availableResourceIdSet = new Set(availableResourceIds);
  if (scopePreset === 'all') {
    return {
      selectedStatIds: undefined,
      selectedResourceIds: undefined
    };
  }
  if (scopePreset === 'stats') {
    return {
      selectedStatIds: availableStatIds,
      selectedResourceIds: []
    };
  }
  if (scopePreset === 'resources') {
    return {
      selectedStatIds: [],
      selectedResourceIds: availableResourceIds
    };
  }
  if (selectedGroup) {
    return {
      selectedStatIds: selectedGroup.statIds.filter((id) => availableStatIdSet.has(id)),
      selectedResourceIds: selectedGroup.resourceIds.filter((id) => availableResourceIdSet.has(id))
    };
  }
  return {
    selectedStatIds: selectedStatIds.filter((id) => availableStatIdSet.has(id)),
    selectedResourceIds: selectedResourceIds.filter((id) => availableResourceIdSet.has(id))
  };
};

export interface CharacterBlockContext {
  runtimeModifiers: CharacterRuntimeModifiers;
  statDefinitionNameById: Map<string, string>;
  resourceDefinitionNameById: Map<string, string>;
  getEffectiveStatValue: (params: {definitionId: string; baseValue: number; runtime: CharacterRuntimeModifiers}) => number;
  getEffectiveResourceValues: (params: {
    definitionId: string;
    current: number;
    max: number;
    runtime: CharacterRuntimeModifiers;
  }) => {current: number; max: number};
}

export const renderCharacterStatBlock = (
  sheet: CharacterSheet,
  style: StatBlockStyle,
  context: CharacterBlockContext,
  selection?: StatBlockSelection
): string => {
  const {runtimeModifiers, statDefinitionNameById, resourceDefinitionNameById, getEffectiveStatValue, getEffectiveResourceValues} = context;
  const selectedStatSet = selection?.selectedStatIds ? new Set(selection.selectedStatIds) : null;
  const selectedResourceSet = selection?.selectedResourceIds ? new Set(selection.selectedResourceIds) : null;
  const effectiveLevel = Math.max(1, sheet.level + runtimeModifiers.levelBonus);
  return buildCharacterStatBlockHtml(
    {
      name: sheet.name,
      level: sheet.level,
      effectiveLevel,
      experience: sheet.experience,
      stats: sheet.stats
        .filter((stat) => (selectedStatSet ? selectedStatSet.has(stat.definitionId) : true))
        .map((stat) => {
          const effective = getEffectiveStatValue({
            definitionId: stat.definitionId,
            baseValue: stat.value,
            runtime: runtimeModifiers
          });
          const modifierNotes = (stat.modifiers ?? [])
            .map((modifier) =>
              modifier.type === 'multiplier'
                ? `${modifier.source} x${modifier.value}`
                : `${modifier.source} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`
            )
            .join(', ');
          return {
            name: statDefinitionNameById.get(stat.definitionId) ?? stat.definitionId,
            baseValue: stat.value,
            effectiveValue: effective,
            modifierNotes
          };
        }),
      resources: sheet.resources
        .filter((resource) => (selectedResourceSet ? selectedResourceSet.has(resource.definitionId) : true))
        .map((resource) => {
          const effective = getEffectiveResourceValues({
            definitionId: resource.definitionId,
            current: resource.current,
            max: resource.max,
            runtime: runtimeModifiers
          });
          return {
            name: resourceDefinitionNameById.get(resource.definitionId) ?? resource.definitionId,
            current: resource.current,
            max: resource.max,
            effectiveCurrent: effective.current,
            effectiveMax: effective.max
          };
        }),
      activeNotes: runtimeModifiers.notes
    },
    style
  );
};

export const renderItemStatBlock = (entity: WorldEntity, style: StatBlockStyle): string =>
  buildItemStatBlockHtml(
    {
      name: entity.name,
      fields: Object.entries(entity.fields)
        .map(([key, value]) => ({
          key,
          value: formatEntityFieldValue(value)
        }))
        .filter((entry) => Boolean(entry.value))
    },
    style
  );

/** A source by exact id, else by case-insensitive trimmed name. */
export const findStatBlockSource = <T extends {id: string; name: string}>(pool: T[], sourceRef: string): T | undefined => {
  const normalizedRef = sourceRef.trim().toLowerCase();
  return (
    pool.find((candidate) => candidate.id === sourceRef) ??
    pool.find((candidate) => candidate.name.trim().toLowerCase() === normalizedRef)
  );
};

export const resolveStatBlockTokenMatch = (
  token: ParsedStatBlockToken,
  characterSheets: CharacterSheet[],
  entities: WorldEntity[]
): StatBlockTokenMatch => {
  const normalizedSourceRef = token.sourceRef.trim().toLowerCase();
  const normalizedLabel = token.label?.trim().toLowerCase() ?? '';
  const targetPool =
    token.sourceType === 'character'
      ? characterSheets.map((sheet) => ({
          id: sheet.id,
          name: sheet.name,
          kind: 'character' as const
        }))
      : entities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          kind: 'item' as const
        }));

  const idMatch = targetPool.find((entry) => entry.id === token.sourceRef);
  if (idMatch) {
    return {
      status: 'resolved',
      label: token.label?.trim() || idMatch.name,
      matchName: idMatch.name,
      candidates: [idMatch.name]
    };
  }

  const labelCandidates = targetPool.filter((entry) => entry.name.trim().toLowerCase() === normalizedLabel);
  if (normalizedLabel) {
    if (labelCandidates.length === 1) {
      return {
        status: 'resolved',
        label: token.label?.trim() || labelCandidates[0].name,
        matchName: labelCandidates[0].name,
        candidates: [labelCandidates[0].name]
      };
    }
    if (labelCandidates.length > 1) {
      return {
        status: 'ambiguous',
        label: token.label?.trim() || labelCandidates[0].name,
        candidates: labelCandidates.map((entry) => entry.name)
      };
    }
  }

  const sourceRefCandidates = targetPool.filter((entry) => entry.name.trim().toLowerCase() === normalizedSourceRef);
  if (sourceRefCandidates.length === 1) {
    return {
      status: 'resolved',
      label: token.label?.trim() || sourceRefCandidates[0].name,
      matchName: sourceRefCandidates[0].name,
      candidates: [sourceRefCandidates[0].name]
    };
  }
  if (sourceRefCandidates.length > 1) {
    return {
      status: 'ambiguous',
      label: token.label?.trim() || sourceRefCandidates[0].name,
      candidates: sourceRefCandidates.map((entry) => entry.name)
    };
  }

  return {
    status: 'missing',
    label: token.label?.trim() || token.sourceRef,
    candidates: []
  };
};

export const describeStatBlockToken = (
  rawToken: string,
  resolve: (token: ParsedStatBlockToken) => StatBlockTokenMatch
): StatBlockTokenPresentation => {
  const parsed = parseStatBlockToken(rawToken);
  if (!parsed) {
    return getDefaultStatBlockTokenPresentation(rawToken);
  }
  const resolution = resolve(parsed);
  const baseLabel = `${getStatBlockTokenDisplayLabel(parsed)} · ${getStatBlockStyleLabel(parsed.style)}`;
  if (resolution.status === 'resolved') {
    return {
      rawToken,
      label: `Stat Block: ${baseLabel}`,
      status: 'resolved',
      title: `Bound to ${resolution.matchName}. Click to inspect token status.`
    };
  }
  if (resolution.status === 'ambiguous') {
    return {
      rawToken,
      label: `Stat Block: ${baseLabel} · Needs rebind`,
      status: 'ambiguous',
      title: `This token matches multiple ${parsed.sourceType === 'character' ? 'records' : 'entities'}. Candidates: ${resolution.candidates.join(', ')}.`
    };
  }
  return {
    rawToken,
    label: `Stat Block: ${baseLabel} · Missing source`,
    status: 'missing',
    title: `No matching ${parsed.sourceType === 'character' ? 'character sheet' : 'entity'} found for this token.`
  };
};

export const buildStatBlockPreviewData = (
  rawToken: string,
  resolve: (token: ParsedStatBlockToken) => StatBlockTokenMatch,
  render: (token: ParsedStatBlockToken) => string | null
): StatBlockPreviewData => {
  const parsed = parseStatBlockToken(rawToken);
  if (!parsed) {
    return {
      rawToken,
      title: 'Stat Block',
      sourceType: 'character',
      style: 'compact',
      status: 'invalid',
      message: 'This stat block token could not be parsed.',
      html: null,
      requiresRebind: true
    };
  }

  const resolution = resolve(parsed);
  const title = `${getStatBlockTokenDisplayLabel(parsed)} · ${getStatBlockStyleLabel(parsed.style)}`;

  if (resolution.status === 'resolved') {
    return {
      rawToken,
      title,
      sourceType: parsed.sourceType,
      style: parsed.style,
      status: 'resolved',
      message:
        parsed.sourceType === 'character'
          ? `Linked to character sheet "${resolution.matchName}".`
          : `Linked to entity "${resolution.matchName}".`,
      html: render(parsed),
      requiresRebind: false
    };
  }

  if (resolution.status === 'ambiguous') {
    return {
      rawToken,
      title,
      sourceType: parsed.sourceType,
      style: parsed.style,
      status: 'ambiguous',
      message: `This token matches multiple records: ${resolution.candidates.join(', ')}.`,
      html: null,
      requiresRebind: true
    };
  }

  return {
    rawToken,
    title,
    sourceType: parsed.sourceType,
    style: parsed.style,
    status: 'missing',
    message: `No matching ${parsed.sourceType === 'character' ? 'character sheet' : 'entity'} is currently available for this token.`,
    html: null,
    requiresRebind: true
  };
};

/** The scope preset a rebind should restore from a token's saved selection. */
export const inferScopePresetFromSelection = (selection: StatBlockSelection): StatBlockScopePreset => {
  const {selectedStatIds, selectedResourceIds} = selection;
  if (selectedStatIds === undefined && selectedResourceIds === undefined) return 'all';
  if ((selectedStatIds?.length ?? 0) > 0 && (selectedResourceIds?.length ?? 0) === 0) return 'stats';
  if ((selectedStatIds?.length ?? 0) === 0 && (selectedResourceIds?.length ?? 0) > 0) return 'resources';
  return 'custom';
};

export const formatRefreshFeedback = (params: {
  replacedCount: number;
  ambiguousCount: number;
  missingCount: number;
}): {tone: 'success' | 'error'; message: string} => {
  const {replacedCount, ambiguousCount, missingCount} = params;
  const skipped = ambiguousCount > 0 || missingCount > 0;
  if (replacedCount === 0) {
    return {
      tone: 'error',
      message: skipped
        ? `No stat block templates were refreshed. ${ambiguousCount} ambiguous and ${missingCount} missing token(s) need attention.`
        : 'No matching STAT_BLOCK templates found to refresh.'
    };
  }
  return {
    tone: 'success',
    message: skipped
      ? `Refreshed ${replacedCount} stat block template(s). ${ambiguousCount} ambiguous and ${missingCount} missing token(s) were skipped.`
      : `Refreshed ${replacedCount} stat block template(s).`
  };
};

/** Saving a group under an existing name (case-insensitive) updates that group in place. */
export const planStatGroupSave = (params: {
  name: string;
  selection: StatBlockSelection;
  groups: StatBlockGroup[];
  createId: () => string;
}):
  | {ok: false; message: string}
  | {ok: true; group: StatBlockGroup; groups: StatBlockGroup[]; updated: boolean} => {
  const name = params.name.trim();
  const statIds = params.selection.selectedStatIds ?? [];
  const resourceIds = params.selection.selectedResourceIds ?? [];
  if (!name) {
    return {ok: false, message: 'Enter a group name first.'};
  }
  if (statIds.length === 0 && resourceIds.length === 0) {
    return {ok: false, message: 'Choose at least one stat/resource before saving a group.'};
  }
  const existing = params.groups.find((group) => group.name.trim().toLowerCase() === name.toLowerCase());
  const group: StatBlockGroup = {id: existing?.id ?? params.createId(), name, statIds, resourceIds};
  return {
    ok: true,
    group,
    updated: Boolean(existing),
    groups: existing
      ? params.groups.map((entry) => (entry.id === existing.id ? group : entry))
      : [...params.groups, group]
  };
};

/** The scene-history line recorded after a character block is inserted. */
export const describeCharacterBlockInsert = (sheet: CharacterSheet): string => {
  const resourcePreview = sheet.resources
    .slice(0, 2)
    .map((resource) => `${resource.definitionId}: ${resource.current}/${resource.max}`)
    .join(', ');
  return (
    `Status block inserted for ${sheet.name} (Lv ${sheet.level}, ${sheet.experience} XP)` +
    (resourcePreview ? ` · ${resourcePreview}` : '.')
  );
};

export type StatBlockInsertPlan =
  | {kind: 'error'; message: string}
  | {kind: 'rebind'; html: string}
  | {
      kind: 'insert';
      insertContent: string;
      message: string;
      history: {category: 'resource' | 'system'; message: string; insertText: string} | null;
    };

/**
 * Decides what inserting a stat block does: an error, a rebind of an existing
 * token in the scene, or new content with its feedback and history entry.
 */
export const planStatBlockInsert = (params: {
  sourceType: StatBlockSourceType;
  scopePreset: StatBlockScopePreset;
  selection: StatBlockSelection;
  selectedSheet: CharacterSheet | null;
  selectedEntity: WorldEntity | null;
  style: StatBlockStyle;
  insertMode: StatBlockInsertMode;
  projectMode: string;
  pendingRebindToken: string | null;
  content: string;
  renderCharacter: (sheet: CharacterSheet, style: StatBlockStyle, selection: StatBlockSelection) => string;
  renderItem: (entity: WorldEntity, style: StatBlockStyle) => string;
  renderTokenChip: (token: string) => string;
}): StatBlockInsertPlan => {
  const {sourceType, scopePreset, selection, selectedSheet, selectedEntity, style, insertMode, projectMode, pendingRebindToken} = params;
  const hasCharacterSelection =
    scopePreset === 'all' ||
    (selection.selectedStatIds?.length ?? 0) > 0 ||
    (selection.selectedResourceIds?.length ?? 0) > 0;
  if (sourceType === 'character' && !hasCharacterSelection) {
    return {kind: 'error', message: 'Select at least one stat or resource for this status block.'};
  }

  const token =
    sourceType === 'character'
      ? selectedSheet
        ? createStatBlockToken({
            sourceType: 'character',
            sourceRef: selectedSheet.id,
            label: selectedSheet.name.trim() || selectedSheet.id,
            style,
            selectedStatIds: selection.selectedStatIds,
            selectedResourceIds: selection.selectedResourceIds
          })
        : null
      : selectedEntity
        ? createStatBlockToken({
            sourceType: 'item',
            sourceRef: selectedEntity.id,
            label: selectedEntity.name.trim() || selectedEntity.id,
            style
          })
        : null;
  const html =
    sourceType === 'character'
      ? selectedSheet
        ? params.renderCharacter(selectedSheet, style, selection)
        : null
      : selectedEntity
        ? params.renderItem(selectedEntity, style)
        : null;

  if (!html || !token) {
    return {
      kind: 'error',
      message: sourceType === 'character' ? 'Select a character sheet to insert.' : 'Select an item/entity to insert.'
    };
  }

  const shouldInsertAsTemplate =
    pendingRebindToken !== null || (insertMode === 'template' && projectMode !== 'litrpg');
  if (pendingRebindToken) {
    const result = replaceFirstStatBlockTokenInHtml(
      params.content,
      pendingRebindToken,
      `<p>${params.renderTokenChip(token)}</p>`
    );
    return result.replaced
      ? {kind: 'rebind', html: result.html}
      : {kind: 'error', message: 'Could not find the stat block token to rebind.'};
  }

  let history: Extract<StatBlockInsertPlan, {kind: 'insert'}>['history'] = null;
  if (sourceType === 'character' && selectedSheet) {
    const message = describeCharacterBlockInsert(selectedSheet);
    history = {category: 'resource', message, insertText: `System Status: ${message}`};
  } else if (sourceType === 'item' && selectedEntity) {
    history = {
      category: 'system',
      message: `Status block inserted for entity "${selectedEntity.name}".`,
      insertText: `System Status: Entity "${selectedEntity.name}" record inserted into scene.`
    };
  }

  return {
    kind: 'insert',
    insertContent: shouldInsertAsTemplate ? `<p>${params.renderTokenChip(token)}</p>` : html,
    message: shouldInsertAsTemplate
      ? 'Inserted STAT_BLOCK template token.'
      : insertMode === 'template' && projectMode === 'litrpg'
        ? 'Inserted live status block (LitRPG mode auto-resolves placeholders).'
        : 'Inserted status block into scene.',
    history
  };
};
