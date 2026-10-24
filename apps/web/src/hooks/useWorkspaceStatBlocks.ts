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
  extractStatBlockTokensFromHtml,
  parseStatBlockToken,
  renderStatBlockTokenChipHtml,
  replaceStatBlockTokensInHtml
} from '../utils/statBlockTemplates';
import type {ParsedStatBlockToken} from '../utils/statBlockTemplates';
import {
  buildStatBlockPreviewData,
  describeStatBlockToken,
  findStatBlockSource,
  formatRefreshFeedback,
  planStatBlockInsert,
  planStatGroupSave,
  renderCharacterStatBlock,
  renderItemStatBlock,
  resolveCharacterSelection as resolveCharacterSelectionFor,
  resolveStatBlockTokenMatch,
  type StatBlockPreviewData,
  type StatBlockSelection
} from '../services/workspace/statBlockResolution';
import {countWords} from '../utils/textHelpers';
import {useStatBlockPreferencePersistence} from './useStatBlockPreferencePersistence';
import {useStatBlockRebind} from './useStatBlockRebind';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorkspaceStatBlocksParams {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
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

export type {StatBlockPreviewData};

export const useWorkspaceStatBlocks = (params: UseWorkspaceStatBlocksParams) => {
  const {
    activeProject,
    projectSettings,
    saveProjectSettings,
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

  useStatBlockPreferencePersistence({
    activeProject,
    projectSettings,
    saveProjectSettings,
    isStatPreferencesHydrated,
    preferences: {
      sourceType: statBlockSourceType,
      style: statBlockStyle,
      insertMode: statBlockInsertMode,
      scopePreset: statBlockScopePreset,
      selectedGroupId: selectedStatGroupId,
      selectedStatIds,
      selectedResourceIds,
      groups: statBlockGroups
    }
  });

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

  const resolveCharacterSelection = useCallback(
    (): StatBlockSelection =>
      resolveCharacterSelectionFor({
        scopePreset: statBlockScopePreset,
        availableStatIds,
        availableResourceIds,
        selectedGroup: selectedStatGroup,
        selectedStatIds,
        selectedResourceIds
      }),
    [statBlockScopePreset, availableStatIds, availableResourceIds, selectedStatGroup, selectedStatIds, selectedResourceIds]
  );

  const resolveCharacterBlock = useCallback(
    (sheet: CharacterSheet, style: StatBlockStyle, selection?: StatBlockSelection): string =>
      renderCharacterStatBlock(
        sheet,
        style,
        {runtimeModifiers, statDefinitionNameById, resourceDefinitionNameById, getEffectiveStatValue, getEffectiveResourceValues},
        selection
      ),
    [getEffectiveResourceValues, getEffectiveStatValue, resourceDefinitionNameById, runtimeModifiers, statDefinitionNameById]
  );

  const resolveItemBlock = useCallback(
    (entity: WorldEntity, style: StatBlockStyle): string => renderItemStatBlock(entity, style),
    []
  );

  const resolveTemplateToBlock = useCallback(
    (
      sourceType: StatBlockSourceType,
      sourceRef: string,
      style: StatBlockStyle,
      selection?: StatBlockSelection
    ): string | null => {
      if (sourceType === 'character') {
        const sheet = findStatBlockSource(characterSheets, sourceRef);
        return sheet ? resolveCharacterBlock(sheet, style, selection) : null;
      }
      const entity = findStatBlockSource(entities, sourceRef);
      return entity ? resolveItemBlock(entity, style) : null;
    },
    [characterSheets, entities, resolveCharacterBlock, resolveItemBlock]
  );

  const resolveTokenMatch = useCallback(
    (token: ParsedStatBlockToken) => resolveStatBlockTokenMatch(token, characterSheets, entities),
    [characterSheets, entities]
  );

  const renderToken = useCallback(
    (token: ParsedStatBlockToken) =>
      resolveTemplateToBlock(token.sourceType, token.sourceRef, token.style, {
        selectedStatIds: token.selectedStatIds,
        selectedResourceIds: token.selectedResourceIds
      }),
    [resolveTemplateToBlock]
  );

  const getStatBlockTokenPresentation = useCallback(
    (rawToken: string) => describeStatBlockToken(rawToken, resolveTokenMatch),
    [resolveTokenMatch]
  );

  const getStatBlockPreviewData = useCallback(
    (rawToken: string): StatBlockPreviewData => buildStatBlockPreviewData(rawToken, resolveTokenMatch, renderToken),
    [renderToken, resolveTokenMatch]
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
      resolveTokenMatch(token).status !== 'resolved' ? null : renderToken(token)
    );
    const feedback = formatRefreshFeedback({replacedCount: result.replacedCount, ambiguousCount, missingCount});
    if (result.replacedCount === 0) {
      setFeedback(feedback);
      return;
    }
    setContent(result.html);
    setSaveStatus('idle');
    setWordCount(countWords(result.html));
    setFeedback(feedback);
    addSystemHistory({
      category: 'system',
      message: `Refreshed ${result.replacedCount} stat block template(s).`,
      insertText: `System Update: Refreshed ${result.replacedCount} stat templates in scene text.`
    });
  }, [
    addSystemHistory,
    content,
    renderToken,
    resolveTokenMatch,
    setContent,
    setFeedback,
    setSaveStatus,
    setWordCount
  ]);

  const handleInsertStatBlock = useCallback(() => {
    const plan = planStatBlockInsert({
      sourceType: statBlockSourceType,
      scopePreset: statBlockScopePreset,
      selection: resolveCharacterSelection(),
      selectedSheet,
      selectedEntity,
      style: statBlockStyle,
      insertMode: statBlockInsertMode,
      projectMode: activeProjectMode,
      pendingRebindToken: pendingStatBlockRebindToken,
      content,
      renderCharacter: resolveCharacterBlock,
      renderItem: resolveItemBlock,
      renderTokenChip: (token) => renderStatBlockTokenChipHtml(token, getStatBlockTokenPresentation(token))
    });
    if (plan.kind === 'error') {
      setFeedback({tone: 'error', message: plan.message});
      return;
    }
    if (plan.kind === 'rebind') {
      setContent(plan.html);
      setSaveStatus('idle');
      setWordCount(countWords(plan.html));
      setPendingStatBlockRebindToken(null);
      setStatBlockModalOpen(false);
      setFeedback({tone: 'success', message: 'Rebound stat block placeholder.'});
      return;
    }
    setStatBlockInsertContent(plan.insertContent);
    setStatBlockModalOpen(false);
    setFeedback({tone: 'success', message: plan.message});
    if (plan.history) {
      addSystemHistory(plan.history);
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

  const {openStatBlockRebind, handleStatBlockTokenClick} = useStatBlockRebind({
    characterSheets,
    entities,
    resolveTokenMatch,
    setFeedback,
    setPendingStatBlockRebindToken,
    setStatBlockSourceType,
    setStatBlockStyle,
    setStatBlockInsertMode,
    setStatBlockModalOpen,
    setStatBlockScopePreset,
    setSelectedStatCharacterId,
    setSelectedStatEntityId,
    setSelectedStatIds,
    setSelectedResourceIds,
    setSelectedStatGroupId
  });

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
    const plan = planStatGroupSave({
      name: newStatGroupName,
      selection: resolveCharacterSelection(),
      groups: statBlockGroups,
      createId: () => crypto.randomUUID()
    });
    if (!plan.ok) {
      setFeedback({tone: 'error', message: plan.message});
      return;
    }
    const nextGroup = plan.group;
    setStatBlockGroups((prev) =>
      plan.updated ? prev.map((group) => (group.id === nextGroup.id ? nextGroup : group)) : [...prev, nextGroup]
    );
    setSelectedStatGroupId(nextGroup.id);
    setStatBlockScopePreset('custom');
    setNewStatGroupName('');
    setFeedback({
      tone: 'success',
      message: plan.updated ? `Updated stat group "${nextGroup.name}".` : `Saved stat group "${nextGroup.name}".`
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
