import {useCallback, useEffect, useMemo} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  CharacterSheet,
  Project,
  ProjectSettings,
  StatBlockGroup,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  StoredRuleset,
  WorldEntity
} from '../entityTypes';
import type {CharacterRuntimeModifiers} from '../services/compendium';
import {
  buildCharacterStatBlockHtml,
  buildItemStatBlockHtml,
  createStatBlockToken,
  extractStatBlockTokensFromHtml,
  formatEntityFieldValue,
  getDefaultStatBlockTokenPresentation,
  getStatBlockStyleLabel,
  getStatBlockTokenDisplayLabel,
  parseStatBlockToken,
  renderStatBlockTokenChipHtml,
  replaceFirstStatBlockTokenInHtml,
  replaceStatBlockTokensInHtml
} from '../utils/statBlockTemplates';
import type {
  ParsedStatBlockToken,
  StatBlockTokenPresentation
} from '../utils/statBlockTemplates';
import {countWords} from '../utils/textHelpers';
import {saveProjectSettings} from '../settingsStorage';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorkspaceStatBlocksParams {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  setProjectSettings: Dispatch<SetStateAction<ProjectSettings | null>>;
  isStatPreferencesHydrated: boolean;
  statBlockSourceType: StatBlockSourceType;
  setStatBlockSourceType: Dispatch<SetStateAction<StatBlockSourceType>>;
  statBlockStyle: StatBlockStyle;
  setStatBlockStyle: Dispatch<SetStateAction<StatBlockStyle>>;
  statBlockInsertMode: StatBlockInsertMode;
  setStatBlockInsertMode: Dispatch<SetStateAction<StatBlockInsertMode>>;
  statBlockScopePreset: StatBlockScopePreset;
  setStatBlockScopePreset: Dispatch<SetStateAction<StatBlockScopePreset>>;
  selectedStatGroupId: string;
  setSelectedStatGroupId: Dispatch<SetStateAction<string>>;
  selectedStatIds: string[];
  setSelectedStatIds: Dispatch<SetStateAction<string[]>>;
  selectedResourceIds: string[];
  setSelectedResourceIds: Dispatch<SetStateAction<string[]>>;
  statBlockGroups: StatBlockGroup[];
  setStatBlockGroups: Dispatch<SetStateAction<StatBlockGroup[]>>;
  newStatGroupName: string;
  setNewStatGroupName: Dispatch<SetStateAction<string>>;
  selectedStatCharacterId: string;
  setSelectedStatCharacterId: Dispatch<SetStateAction<string>>;
  selectedStatEntityId: string;
  setSelectedStatEntityId: Dispatch<SetStateAction<string>>;
  statBlockInsertContent: string | null;
  setStatBlockInsertContent: Dispatch<SetStateAction<string | null>>;
  isStatBlockModalOpen: boolean;
  setStatBlockModalOpen: Dispatch<SetStateAction<boolean>>;
  pendingStatBlockRebindToken: string | null;
  setPendingStatBlockRebindToken: Dispatch<SetStateAction<string | null>>;
  characterSheets: CharacterSheet[];
  entities: WorldEntity[];
  ruleset: StoredRuleset | null;
  runtimeModifiers: CharacterRuntimeModifiers;
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved'>>;
  setWordCount: Dispatch<SetStateAction<number>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  addSystemHistory: (input: {
    category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
    message: string;
    insertText?: string;
    sceneId?: string;
  }) => void;
  getEffectiveStatValue: (params: {
    definitionId: string;
    baseValue: number;
    runtime: CharacterRuntimeModifiers;
  }) => number;
  getEffectiveResourceValues: (params: {
    definitionId: string;
    current: number;
    max: number;
    runtime: CharacterRuntimeModifiers;
  }) => {current: number; max: number};
}

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

export const useWorkspaceStatBlocks = (params: UseWorkspaceStatBlocksParams) => {
  const {
    activeProject,
    projectSettings,
    setProjectSettings,
    isStatPreferencesHydrated,
    statBlockSourceType,
    setStatBlockSourceType,
    statBlockStyle,
    setStatBlockStyle,
    statBlockInsertMode,
    setStatBlockInsertMode,
    statBlockScopePreset,
    setStatBlockScopePreset,
    selectedStatGroupId,
    setSelectedStatGroupId,
    selectedStatIds,
    setSelectedStatIds,
    selectedResourceIds,
    setSelectedResourceIds,
    statBlockGroups,
    setStatBlockGroups,
    newStatGroupName,
    setNewStatGroupName,
    selectedStatCharacterId,
    setSelectedStatCharacterId,
    selectedStatEntityId,
    setSelectedStatEntityId,
    statBlockInsertContent,
    setStatBlockInsertContent,
    isStatBlockModalOpen,
    setStatBlockModalOpen,
    pendingStatBlockRebindToken,
    setPendingStatBlockRebindToken,
    characterSheets,
    entities,
    ruleset,
    runtimeModifiers,
    content,
    setContent,
    setSaveStatus,
    setWordCount,
    setFeedback,
    addSystemHistory,
    getEffectiveStatValue,
    getEffectiveResourceValues
  } = params;

  useEffect(() => {
    if (!activeProject || !projectSettings || !isStatPreferencesHydrated) {
      return;
    }
    const currentPrefs = projectSettings.statBlockPreferences;
    const currentGroupsJson = JSON.stringify(currentPrefs?.groups ?? []);
    const nextGroupsJson = JSON.stringify(statBlockGroups);
    const currentStatIdsJson = JSON.stringify(currentPrefs?.selectedStatIds ?? []);
    const nextStatIdsJson = JSON.stringify(selectedStatIds);
    const currentResourceIdsJson = JSON.stringify(
      currentPrefs?.selectedResourceIds ?? []
    );
    const nextResourceIdsJson = JSON.stringify(selectedResourceIds);
    if (
      currentPrefs?.sourceType === statBlockSourceType &&
      currentPrefs?.style === statBlockStyle &&
      currentPrefs?.insertMode === statBlockInsertMode &&
      currentPrefs?.scopePreset === statBlockScopePreset &&
      (currentPrefs?.selectedGroupId ?? '') === selectedStatGroupId &&
      currentGroupsJson === nextGroupsJson &&
      currentStatIdsJson === nextStatIdsJson &&
      currentResourceIdsJson === nextResourceIdsJson
    ) {
      return;
    }
    const nextSettings: ProjectSettings = {
      ...projectSettings,
      statBlockPreferences: {
        sourceType: statBlockSourceType,
        style: statBlockStyle,
        insertMode: statBlockInsertMode,
        scopePreset: statBlockScopePreset,
        selectedGroupId: selectedStatGroupId,
        selectedStatIds: [...selectedStatIds],
        selectedResourceIds: [...selectedResourceIds],
        groups: statBlockGroups
      },
      updatedAt: Date.now()
    };
    setProjectSettings(nextSettings);
    void saveProjectSettings(nextSettings);
  }, [
    activeProject,
    projectSettings,
    statBlockSourceType,
    statBlockStyle,
    statBlockInsertMode,
    statBlockScopePreset,
    selectedStatGroupId,
    selectedStatIds,
    selectedResourceIds,
    statBlockGroups,
    isStatPreferencesHydrated,
    setProjectSettings
  ]);

  const statDefinitionNameById = useMemo(() => {
    const map = new Map<string, string>();
    ruleset?.statDefinitions.forEach((def) => {
      map.set(def.id, def.name);
    });
    return map;
  }, [ruleset]);

  const resourceDefinitionNameById = useMemo(() => {
    const map = new Map<string, string>();
    ruleset?.resourceDefinitions.forEach((def) => {
      map.set(def.id, def.name);
    });
    return map;
  }, [ruleset]);

  const selectedSheet =
    characterSheets.find((sheet) => sheet.id === selectedStatCharacterId) ?? null;
  const selectedEntity =
    entities.find((entity) => entity.id === selectedStatEntityId) ?? null;
  const activeProjectMode = projectSettings?.projectMode ?? 'litrpg';
  const canInsertStatBlock =
    (statBlockSourceType === 'character' && characterSheets.length > 0) ||
    (statBlockSourceType === 'item' && entities.length > 0);

  const availableStatIds = useMemo(
    () => (selectedSheet ? selectedSheet.stats.map((stat) => stat.definitionId) : []),
    [selectedSheet]
  );
  const availableResourceIds = useMemo(
    () =>
      selectedSheet
        ? selectedSheet.resources.map((resource) => resource.definitionId)
        : [],
    [selectedSheet]
  );
  const availableStatIdSet = useMemo(() => new Set(availableStatIds), [availableStatIds]);
  const availableResourceIdSet = useMemo(
    () => new Set(availableResourceIds),
    [availableResourceIds]
  );

  useEffect(() => {
    setSelectedStatIds((prev) => prev.filter((id) => availableStatIdSet.has(id)));
  }, [availableStatIdSet, setSelectedStatIds]);

  useEffect(() => {
    setSelectedResourceIds((prev) =>
      prev.filter((id) => availableResourceIdSet.has(id))
    );
  }, [availableResourceIdSet, setSelectedResourceIds]);

  const selectedStatGroup = useMemo(
    () => statBlockGroups.find((group) => group.id === selectedStatGroupId) ?? null,
    [statBlockGroups, selectedStatGroupId]
  );

  const resolveCharacterSelection = useCallback(() => {
    if (statBlockScopePreset === 'all') {
      return {
        selectedStatIds: undefined,
        selectedResourceIds: undefined
      };
    }
    if (statBlockScopePreset === 'stats') {
      return {
        selectedStatIds: availableStatIds,
        selectedResourceIds: []
      };
    }
    if (statBlockScopePreset === 'resources') {
      return {
        selectedStatIds: [],
        selectedResourceIds: availableResourceIds
      };
    }
    if (selectedStatGroup) {
      return {
        selectedStatIds: selectedStatGroup.statIds.filter((id) =>
          availableStatIdSet.has(id)
        ),
        selectedResourceIds: selectedStatGroup.resourceIds.filter((id) =>
          availableResourceIdSet.has(id)
        )
      };
    }
    return {
      selectedStatIds: selectedStatIds.filter((id) => availableStatIdSet.has(id)),
      selectedResourceIds: selectedResourceIds.filter((id) =>
        availableResourceIdSet.has(id)
      )
    };
  }, [
    statBlockScopePreset,
    availableStatIds,
    availableResourceIds,
    selectedStatGroup,
    selectedStatIds,
    selectedResourceIds,
    availableStatIdSet,
    availableResourceIdSet
  ]);

  const resolveCharacterBlock = useCallback(
    (
      sheet: CharacterSheet,
      style: StatBlockStyle,
      selection?: {selectedStatIds?: string[]; selectedResourceIds?: string[]}
    ): string => {
      const selectedStatSet = selection?.selectedStatIds
        ? new Set(selection.selectedStatIds)
        : null;
      const selectedResourceSet = selection?.selectedResourceIds
        ? new Set(selection.selectedResourceIds)
        : null;
      const effectiveLevel = Math.max(1, sheet.level + runtimeModifiers.levelBonus);
      return buildCharacterStatBlockHtml(
        {
          name: sheet.name,
          level: sheet.level,
          effectiveLevel,
          experience: sheet.experience,
          stats: sheet.stats
            .filter((stat) =>
              selectedStatSet ? selectedStatSet.has(stat.definitionId) : true
            )
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
            .filter((resource) =>
              selectedResourceSet ? selectedResourceSet.has(resource.definitionId) : true
            )
            .map((resource) => {
              const effective = getEffectiveResourceValues({
                definitionId: resource.definitionId,
                current: resource.current,
                max: resource.max,
                runtime: runtimeModifiers
              });
              return {
                name:
                  resourceDefinitionNameById.get(resource.definitionId) ??
                  resource.definitionId,
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
    },
    [
      getEffectiveResourceValues,
      getEffectiveStatValue,
      resourceDefinitionNameById,
      runtimeModifiers,
      statDefinitionNameById
    ]
  );

  const resolveItemBlock = useCallback((entity: WorldEntity, style: StatBlockStyle): string => {
    return buildItemStatBlockHtml(
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
  }, []);

  const resolveTemplateToBlock = useCallback(
    (
      sourceType: StatBlockSourceType,
      sourceRef: string,
      style: StatBlockStyle,
      selection?: {selectedStatIds?: string[]; selectedResourceIds?: string[]}
    ): string | null => {
      if (sourceType === 'character') {
        const normalizedRef = sourceRef.trim().toLowerCase();
        const sheet =
          characterSheets.find((candidate) => candidate.id === sourceRef) ??
          characterSheets.find(
            (candidate) => candidate.name.trim().toLowerCase() === normalizedRef
          );
        return sheet ? resolveCharacterBlock(sheet, style, selection) : null;
      }
      const normalizedRef = sourceRef.trim().toLowerCase();
      const entity =
        entities.find((candidate) => candidate.id === sourceRef) ??
        entities.find(
          (candidate) => candidate.name.trim().toLowerCase() === normalizedRef
        );
      return entity ? resolveItemBlock(entity, style) : null;
    },
    [characterSheets, entities, resolveCharacterBlock, resolveItemBlock]
  );

  const resolveTokenMatch = useCallback(
    (token: ParsedStatBlockToken) => {
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
          status: 'resolved' as const,
          label: token.label?.trim() || idMatch.name,
          matchName: idMatch.name,
          candidates: [idMatch.name]
        };
      }

      const labelCandidates = targetPool.filter(
        (entry) => entry.name.trim().toLowerCase() === normalizedLabel
      );
      if (normalizedLabel) {
        if (labelCandidates.length === 1) {
          return {
            status: 'resolved' as const,
            label: token.label?.trim() || labelCandidates[0].name,
            matchName: labelCandidates[0].name,
            candidates: [labelCandidates[0].name]
          };
        }
        if (labelCandidates.length > 1) {
          return {
            status: 'ambiguous' as const,
            label: token.label?.trim() || labelCandidates[0].name,
            candidates: labelCandidates.map((entry) => entry.name)
          };
        }
      }

      const sourceRefCandidates = targetPool.filter(
        (entry) => entry.name.trim().toLowerCase() === normalizedSourceRef
      );
      if (sourceRefCandidates.length === 1) {
        return {
          status: 'resolved' as const,
          label: token.label?.trim() || sourceRefCandidates[0].name,
          matchName: sourceRefCandidates[0].name,
          candidates: [sourceRefCandidates[0].name]
        };
      }
      if (sourceRefCandidates.length > 1) {
        return {
          status: 'ambiguous' as const,
          label: token.label?.trim() || sourceRefCandidates[0].name,
          candidates: sourceRefCandidates.map((entry) => entry.name)
        };
      }

      return {
        status: 'missing' as const,
        label: token.label?.trim() || token.sourceRef,
        candidates: []
      };
    },
    [characterSheets, entities]
  );

  const getStatBlockTokenPresentation = useCallback(
    (rawToken: string): StatBlockTokenPresentation => {
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) {
        return getDefaultStatBlockTokenPresentation(rawToken);
      }
      const resolution = resolveTokenMatch(parsed);
      const baseLabel = `${getStatBlockTokenDisplayLabel(parsed)} · ${getStatBlockStyleLabel(
        parsed.style
      )}`;
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
    },
    [resolveTokenMatch]
  );

  const getStatBlockPreviewData = useCallback(
    (rawToken: string): StatBlockPreviewData => {
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

      const resolution = resolveTokenMatch(parsed);
      const title = `${getStatBlockTokenDisplayLabel(parsed)} · ${getStatBlockStyleLabel(
        parsed.style
      )}`;
      const html =
        resolution.status === 'resolved'
          ? resolveTemplateToBlock(parsed.sourceType, parsed.sourceRef, parsed.style, {
              selectedStatIds: parsed.selectedStatIds,
              selectedResourceIds: parsed.selectedResourceIds
            })
          : null;

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
          html,
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
        message: `No matching ${
          parsed.sourceType === 'character' ? 'character sheet' : 'entity'
        } is currently available for this token.`,
        html: null,
        requiresRebind: true
      };
    },
    [resolveTemplateToBlock, resolveTokenMatch]
  );

  const handleRefreshStatTemplates = useCallback(() => {
    const rawTokens = extractStatBlockTokensFromHtml(content);
    const parsedTokens = rawTokens
      .map((rawToken) => parseStatBlockToken(rawToken))
      .filter((token): token is ParsedStatBlockToken => Boolean(token));
    const ambiguousCount = parsedTokens.filter(
      (token) => resolveTokenMatch(token).status === 'ambiguous'
    ).length;
    const missingCount = parsedTokens.filter(
      (token) => resolveTokenMatch(token).status === 'missing'
    ).length;
    const result = replaceStatBlockTokensInHtml(content, (token) =>
      resolveTokenMatch(token).status !== 'resolved'
        ? null
        : resolveTemplateToBlock(token.sourceType, token.sourceRef, token.style, {
            selectedStatIds: token.selectedStatIds,
            selectedResourceIds: token.selectedResourceIds
          })
    );
    if (result.replacedCount === 0) {
      setFeedback({
        tone: 'error',
        message:
          ambiguousCount > 0 || missingCount > 0
            ? `No stat block templates were refreshed. ${ambiguousCount} ambiguous and ${missingCount} missing token(s) need attention.`
            : 'No matching STAT_BLOCK templates found to refresh.'
      });
      return;
    }
    setContent(result.html);
    setSaveStatus('idle');
    setWordCount(countWords(result.html));
    setFeedback({
      tone: 'success',
      message:
        ambiguousCount > 0 || missingCount > 0
          ? `Refreshed ${result.replacedCount} stat block template(s). ${ambiguousCount} ambiguous and ${missingCount} missing token(s) were skipped.`
          : `Refreshed ${result.replacedCount} stat block template(s).`
    });
    addSystemHistory({
      category: 'system',
      message: `Refreshed ${result.replacedCount} stat block template(s).`,
      insertText: `System Update: Refreshed ${result.replacedCount} stat templates in scene text.`
    });
  }, [
    addSystemHistory,
    content,
    resolveTokenMatch,
    resolveTemplateToBlock,
    setContent,
    setFeedback,
    setSaveStatus,
    setWordCount
  ]);

  const handleInsertStatBlock = useCallback(() => {
    const characterSelection = resolveCharacterSelection();
    const hasCharacterSelection =
      statBlockScopePreset === 'all' ||
      ((characterSelection.selectedStatIds?.length ?? 0) > 0 ||
        (characterSelection.selectedResourceIds?.length ?? 0) > 0);
    if (statBlockSourceType === 'character' && !hasCharacterSelection) {
      setFeedback({
        tone: 'error',
        message: 'Select at least one stat or resource for this status block.'
      });
      return;
    }

    const token =
      statBlockSourceType === 'character'
        ? selectedSheet
          ? createStatBlockToken({
              sourceType: 'character',
              sourceRef: selectedSheet.id,
              label: selectedSheet.name.trim() || selectedSheet.id,
              style: statBlockStyle,
              selectedStatIds: characterSelection.selectedStatIds,
              selectedResourceIds: characterSelection.selectedResourceIds
            })
          : null
        : selectedEntity
          ? createStatBlockToken({
              sourceType: 'item',
              sourceRef: selectedEntity.id,
              label: selectedEntity.name.trim() || selectedEntity.id,
              style: statBlockStyle
            })
          : null;
    const html =
      statBlockSourceType === 'character'
        ? selectedSheet
          ? resolveCharacterBlock(selectedSheet, statBlockStyle, characterSelection)
          : null
        : selectedEntity
          ? resolveItemBlock(selectedEntity, statBlockStyle)
          : null;

    if (!html || !token) {
      setFeedback({
        tone: 'error',
        message:
          statBlockSourceType === 'character'
            ? 'Select a character sheet to insert.'
            : 'Select an item/entity to insert.'
      });
      return;
    }

    const shouldInsertAsTemplate =
      pendingStatBlockRebindToken !== null ||
      (statBlockInsertMode === 'template' && activeProjectMode !== 'litrpg');
    if (pendingStatBlockRebindToken) {
      const replacementHtml = `<p>${renderStatBlockTokenChipHtml(
        token,
        getStatBlockTokenPresentation(token)
      )}</p>`;
      const result = replaceFirstStatBlockTokenInHtml(
        content,
        pendingStatBlockRebindToken,
        replacementHtml
      );
      if (!result.replaced) {
        setFeedback({
          tone: 'error',
          message: 'Could not find the stat block token to rebind.'
        });
        return;
      }
      setContent(result.html);
      setSaveStatus('idle');
      setWordCount(countWords(result.html));
      setPendingStatBlockRebindToken(null);
      setStatBlockModalOpen(false);
      setFeedback({
        tone: 'success',
        message: 'Rebound stat block placeholder.'
      });
      return;
    }

    setStatBlockInsertContent(
      shouldInsertAsTemplate ? `<p>${renderStatBlockTokenChipHtml(token, getStatBlockTokenPresentation(token))}</p>` : html
    );
    setStatBlockModalOpen(false);
    setFeedback({
      tone: 'success',
      message:
        shouldInsertAsTemplate
          ? 'Inserted STAT_BLOCK template token.'
          : statBlockInsertMode === 'template' && activeProjectMode === 'litrpg'
            ? 'Inserted live status block (LitRPG mode auto-resolves placeholders).'
            : 'Inserted status block into scene.'
    });

    if (statBlockSourceType === 'character' && selectedSheet) {
      const resourcePreview = selectedSheet.resources
        .slice(0, 2)
        .map((resource) => `${resource.definitionId}: ${resource.current}/${resource.max}`)
        .join(', ');
      const message =
        `Status block inserted for ${selectedSheet.name} (Lv ${selectedSheet.level}, ${selectedSheet.experience} XP)` +
        (resourcePreview ? ` · ${resourcePreview}` : '.');
      addSystemHistory({
        category: 'resource',
        message,
        insertText: `System Status: ${message}`
      });
    } else if (statBlockSourceType === 'item' && selectedEntity) {
      addSystemHistory({
        category: 'system',
        message: `Status block inserted for entity "${selectedEntity.name}".`,
        insertText: `System Status: Entity "${selectedEntity.name}" record inserted into scene.`
      });
    }
  }, [
    activeProjectMode,
    addSystemHistory,
    content,
    getStatBlockTokenPresentation,
    resolveCharacterBlock,
    resolveCharacterSelection,
    resolveItemBlock,
    selectedEntity,
    selectedSheet,
    setContent,
    setFeedback,
    setPendingStatBlockRebindToken,
    setSaveStatus,
    setStatBlockInsertContent,
    setStatBlockModalOpen,
    setWordCount,
    statBlockInsertMode,
    statBlockScopePreset,
    statBlockSourceType,
    statBlockStyle,
    pendingStatBlockRebindToken
  ]);

  const openStatBlockRebind = useCallback(
    (rawToken: string) => {
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) {
        setFeedback({
          tone: 'error',
          message: 'This stat block token could not be parsed.'
        });
        return;
      }

      setPendingStatBlockRebindToken(rawToken);
      setStatBlockSourceType(parsed.sourceType);
      setStatBlockStyle(parsed.style);
      setStatBlockInsertMode('template');
      setStatBlockModalOpen(true);

      if (parsed.sourceType === 'character') {
        const matchingSheet =
          characterSheets.find((sheet) => sheet.id === parsed.sourceRef) ??
          characterSheets.find(
            (sheet) => sheet.name.trim().toLowerCase() === (parsed.label ?? parsed.sourceRef).trim().toLowerCase()
          );
        if (matchingSheet) {
          setSelectedStatCharacterId(matchingSheet.id);
        }
        const nextSelectedStatIds = parsed.selectedStatIds;
        const nextSelectedResourceIds = parsed.selectedResourceIds;
        setSelectedStatIds(nextSelectedStatIds ?? []);
        setSelectedResourceIds(nextSelectedResourceIds ?? []);
        if (nextSelectedStatIds === undefined && nextSelectedResourceIds === undefined) {
          setStatBlockScopePreset('all');
        } else if ((nextSelectedStatIds?.length ?? 0) > 0 && (nextSelectedResourceIds?.length ?? 0) === 0) {
          setStatBlockScopePreset('stats');
        } else if ((nextSelectedStatIds?.length ?? 0) === 0 && (nextSelectedResourceIds?.length ?? 0) > 0) {
          setStatBlockScopePreset('resources');
        } else {
          setStatBlockScopePreset('custom');
        }
        setSelectedStatGroupId('');
      } else {
        const matchingEntity =
          entities.find((entity) => entity.id === parsed.sourceRef) ??
          entities.find(
            (entity) => entity.name.trim().toLowerCase() === (parsed.label ?? parsed.sourceRef).trim().toLowerCase()
          );
        if (matchingEntity) {
          setSelectedStatEntityId(matchingEntity.id);
        }
      }
    },
    [
      characterSheets,
      entities,
      setFeedback,
      setPendingStatBlockRebindToken,
      setSelectedResourceIds,
      setSelectedStatCharacterId,
      setSelectedStatEntityId,
      setSelectedStatGroupId,
      setSelectedStatIds,
      setStatBlockInsertMode,
      setStatBlockModalOpen,
      setStatBlockScopePreset,
      setStatBlockSourceType,
      setStatBlockStyle
    ]
  );

  const handleStatBlockTokenClick = useCallback(
    (rawToken: string) => {
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) {
        setFeedback({
          tone: 'error',
          message: 'This stat block token could not be parsed.'
        });
        return;
      }
      const resolution = resolveTokenMatch(parsed);
      if (resolution.status === 'resolved') {
        setFeedback({
          tone: 'success',
          message: `Stat block token is bound to ${resolution.matchName}.`
        });
        return;
      }
      if (resolution.status === 'ambiguous') {
        openStatBlockRebind(rawToken);
        setFeedback({
          tone: 'error',
          message: `Stat block token is ambiguous. Choose the correct source to rebind it. Matching records: ${resolution.candidates.join(', ')}.`
        });
        return;
      }
      openStatBlockRebind(rawToken);
      setFeedback({
        tone: 'error',
        message: `Stat block token source is missing. Choose a new ${parsed.sourceType} source to rebind it.`
      });
    },
    [openStatBlockRebind, resolveTokenMatch, setFeedback]
  );

  const handleToggleStatSelection = useCallback((statId: string) => {
    setSelectedStatIds((prev) =>
      prev.includes(statId) ? prev.filter((id) => id !== statId) : [...prev, statId]
    );
    setStatBlockScopePreset('custom');
    setSelectedStatGroupId('');
  }, [setSelectedStatGroupId, setSelectedStatIds, setStatBlockScopePreset]);

  const handleToggleResourceSelection = useCallback((resourceId: string) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
    setStatBlockScopePreset('custom');
    setSelectedStatGroupId('');
  }, [setSelectedResourceIds, setSelectedStatGroupId, setStatBlockScopePreset]);

  const handleSaveStatGroup = useCallback(() => {
    const name = newStatGroupName.trim();
    const selection = resolveCharacterSelection();
    const statIds = selection.selectedStatIds ?? [];
    const resourceIds = selection.selectedResourceIds ?? [];
    if (!name) {
      setFeedback({tone: 'error', message: 'Enter a group name first.'});
      return;
    }
    if (statIds.length === 0 && resourceIds.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'Choose at least one stat/resource before saving a group.'
      });
      return;
    }
    const existing = statBlockGroups.find(
      (group) => group.name.trim().toLowerCase() === name.toLowerCase()
    );
    const nextGroup: StatBlockGroup = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      statIds,
      resourceIds
    };
    setStatBlockGroups((prev) => {
      if (existing) {
        return prev.map((group) => (group.id === existing.id ? nextGroup : group));
      }
      return [...prev, nextGroup];
    });
    setSelectedStatGroupId(nextGroup.id);
    setStatBlockScopePreset('custom');
    setNewStatGroupName('');
    setFeedback({
      tone: 'success',
      message: existing
        ? `Updated stat group "${name}".`
        : `Saved stat group "${name}".`
    });
  }, [
    newStatGroupName,
    resolveCharacterSelection,
    setFeedback,
    setNewStatGroupName,
    setSelectedStatGroupId,
    setStatBlockGroups,
    setStatBlockScopePreset,
    statBlockGroups
  ]);

  const handleDeleteStatGroup = useCallback((groupId: string) => {
    const group = statBlockGroups.find((entry) => entry.id === groupId);
    setStatBlockGroups((prev) => prev.filter((entry) => entry.id !== groupId));
    if (selectedStatGroupId === groupId) {
      setSelectedStatGroupId('');
      setStatBlockScopePreset('all');
    }
    if (group) {
      setFeedback({tone: 'success', message: `Deleted stat group "${group.name}".`});
    }
  }, [
    selectedStatGroupId,
    setFeedback,
    setSelectedStatGroupId,
    setStatBlockGroups,
    setStatBlockScopePreset,
    statBlockGroups
  ]);

  const activeCharacterSelection = resolveCharacterSelection();
  const activeSelectedStatSet = new Set(activeCharacterSelection.selectedStatIds ?? []);
  const activeSelectedResourceSet = new Set(
    activeCharacterSelection.selectedResourceIds ?? []
  );
  const statBlockScopeValue = selectedStatGroup
    ? `group:${selectedStatGroup.id}`
    : statBlockScopePreset;

  const closeStatBlockModal = useCallback(() => {
    setPendingStatBlockRebindToken(null);
    setStatBlockModalOpen(false);
  }, [setPendingStatBlockRebindToken, setStatBlockModalOpen]);

  useEffect(() => {
    if (!isStatBlockModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStatBlockModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeStatBlockModal, isStatBlockModalOpen]);

  return {
    statDefinitionNameById,
    resourceDefinitionNameById,
    selectedSheet,
    selectedEntity,
    activeProjectMode,
    canInsertStatBlock,
    selectedStatGroup,
    activeSelectedStatSet,
    activeSelectedResourceSet,
    statBlockScopeValue,
    resolveCharacterBlock,
    resolveItemBlock,
    getStatBlockTokenPresentation,
    getStatBlockPreviewData,
    handleRefreshStatTemplates,
    handleInsertStatBlock,
    handleStatBlockTokenClick,
    openStatBlockRebind,
    handleToggleStatSelection,
    handleToggleResourceSelection,
    handleSaveStatGroup,
    handleDeleteStatGroup,
    closeStatBlockModal,
    setStatBlockSourceType,
    setStatBlockStyle,
    setStatBlockInsertMode,
    setStatBlockScopePreset,
    setSelectedStatGroupId,
    setNewStatGroupName,
    setSelectedStatCharacterId,
    setSelectedStatEntityId,
    statBlockInsertContent
  };
};
