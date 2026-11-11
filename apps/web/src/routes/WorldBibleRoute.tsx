import {useState, useCallback, useRef, useMemo} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import type {WorldEntity} from '../entityTypes';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import {CategoryManager} from '../components/WorldBible/CategoryManager';
import {WorldBibleImportWorkspace} from '../components/WorldBible/WorldBibleImportWorkspace';
import {WorldBibleEntityList} from '../components/WorldBible/WorldBibleEntityList';
import {readAISwitches} from '../services/llm/aiSwitches';
import {CharacterLabDialog} from '../components/CharacterLab/CharacterLabDialog';
import {
  CharacterIntakeDialog,
  type CharacterIntakeKind
} from '../components/WorldBible/CharacterIntakeTasks';
import type {CharacterVoicePosition} from '../services/characterLab';
import {CharacterIdentityResolutionQueue} from '../components/WorldBible/CharacterIdentityResolutionQueue';
import {WorldBibleCategoryRail} from '../components/WorldBible/WorldBibleCategoryRail';
import {WorldBibleCategoryOverview} from '../components/WorldBible/WorldBibleCategoryOverview';
import {WorldBibleParentCanonBanner} from '../components/WorldBible/WorldBibleParentCanonBanner';
import {SystemNegativeSpacePanel} from '../components/WorldBible/SystemNegativeSpacePanel';
import {WorldBibleRecordEditor} from '../components/WorldBible/record/WorldBibleRecordEditor';
import {
  useWorldBibleRecordDraft,
  type RecordReviewFocus
} from '../components/WorldBible/record/useWorldBibleRecordDraft';
import shared from '../components/WorldBible/worldBibleShared.module.css';
import styles from '../styles/WorldBibleRoute.module.css';
import {useWorldBibleReview} from '../hooks/useWorldBibleReview';
import {
  useWorldBibleImports
} from '../hooks/useWorldBibleImports';
import {useWorldBibleEntityActions} from '../hooks/useWorldBibleEntityActions';
import {useWorldBibleLocationFocus} from '../hooks/useWorldBibleLocationFocus';
import {useWorldBibleCategoryNavigation} from '../hooks/useWorldBibleCategoryNavigation';
import {getSeriesBibleConfig} from '../services/seriesBible/SeriesBibleService';
import {
  ALTERNATIVE_NAMES_KEY,
  buildWorldBibleEntityContent,
  formatAlternativeNames,
  normalizeName,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';
import {
  downloadWorldBibleJsonSample,
  downloadWorldBibleJsonTemplate
} from '../services/worldBible/worldBibleJsonTemplates';
import {indexWorldBibleEntity} from '../services/worldBible/indexWorldBibleEntity';
import {useWorldBibleProjectData} from '../hooks/useWorldBibleProjectData';
import {useWorldBibleSelectedEntity} from '../hooks/useWorldBibleSelectedEntity';
import {useCharacterIdentityResolutionQueue} from '../hooks/useCharacterIdentityResolutionQueue';
import {
  useWorldBibleAuthoringAssistant
} from '../hooks/useWorldBibleAuthoringAssistant';
import {useWorldBibleRecordResolution} from '../hooks/useWorldBibleRecordResolution';
import {RouteFeedback} from '../components/common';
import {useWorldCanvas} from '../hooks/useWorldCanvas';

const LATEST_POSITION: CharacterVoicePosition = {kind: 'latest'};

function WorldBibleRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const aiCoaching = readAISwitches(projectSettings?.aiSettings).coaching;
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [importOpenRequest, setImportOpenRequest] = useState(0);
  const [characterIntake, setCharacterIntake] = useState<CharacterIntakeKind | null>(null);
  const [labEntityId, setLabEntityId] = useState<string | null>(null);
  const reviewFilter = 'all' as const;
  const recommendedFilter = 'all' as const;
  const seriesConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const capabilities = getProjectCapabilities(projectSettings);
  const showGameSystems = capabilities.canUseGameSystems;
  const showCharacterMechanics = capabilities.canUseRuleAuthoring;
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const {
    categories,
    categoryById,
    aliasMapByEntityId,
    setCategories,
    entities,
    setEntities,
    characters,
    setCharacters,
    characterSheets,
    setCharacterSheets,
    ruleset,
    setRuleset,
    characterIdentityReport,
    writingDocuments,
    canonicalFacts,
    stateMutationEvents,
    loreDocuments,
    loreDocumentLinks,
    aliases,
    setAliases,
    ragService,
    shodhService,
    memories,
    refreshMemories,
    canonState,
    setCanonState,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds
  } = useWorldBibleProjectData({
    activeProject,
    setFeedback
  });
  const worldCanvas = useWorldCanvas(activeProject?.id ?? null, ragService);
  const characterIdentityResolution = useCharacterIdentityResolutionQueue({
    activeProject, projectSettings, saveProjectSettings, categories, entities,
    characters, characterSheets, report: characterIdentityReport, setFeedback
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  const {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    worldBibleCategories,
    activeCategory,
    characterCategory,
    activeCategoryIsCharacterLike,
    activeCategoryIsSystemNegativeSpace,
    isCategoryRailCollapsed,
    toggleCategoryRail
  } = useWorldBibleCategoryNavigation({
    projectId: activeProject?.id ?? null,
    categories,
    showGameSystems
  });
  const draft = useWorldBibleRecordDraft({
    categories, categoryById, aliasMapByEntityId, activeCategory, writingDocuments
  });
  const {editingId, name, setName, fieldValues, setFieldValues} = draft;
  const worldBibleImports = useWorldBibleImports({
    activeProjectId: activeProject?.id ?? null,
    activeCategory: activeCategory ?? null,
    categories,
    entities,
    setCategories,
    setEntities,
    setFeedback,
    onEntitySaved: (entity, category) =>
      indexWorldBibleEntity(entity, category.slug, {ragService, shodhService}),
    onEntitiesChanged: refreshMemories
  });
  const {isImportingEntities, importDrafts, isImportingJson, updateImportDraft} = worldBibleImports;
  const currentEntityMemories = editingId
    ? memories.filter((memory) => memory.documentId === editingId)
    : [];

  const ignoredEntityMatchKeys = useMemo(
    () => new Set(projectSettings?.ignoredEntityMatchKeys ?? []),
    [projectSettings?.ignoredEntityMatchKeys]
  );
  const selection = useWorldBibleSelectedEntity({
    activeProject,
    editingId,
    categories,
    entities,
    characters,
    characterSheets,
    loreDocuments,
    loreDocumentLinks,
    aliasMapByEntityId,
    canonicalFacts,
    writingDocuments,
    stateMutationEvents,
    ragService,
    categoryById,
    navigate,
    setFeedback
  });
  const {
    selectedEntity,
    selectedEntityAliases,
    linkedLoreDocumentByEntityId,
    linkingLoreEntityId,
    handleOpenOrCreateLinkedLoreDocument
  } = selection;
  const worldBibleAuthoring = useWorldBibleAuthoringAssistant({
    activeCategory: activeCategory ?? null,
    setCategories,
    selectedEntity,
    name,
    setName,
    fieldValues,
    setFieldValues,
    importDrafts,
    categoryById,
    updateImportDraft,
    setFeedback
  });
  const {clearAiHelperDraft, closeRecordAiHelper, resetAiHelpers} = worldBibleAuthoring;
  const isFocusedCharacterTask = activeCategoryIsCharacterLike
    ? Boolean(editingId || draft.characterAuthoringMode !== 'idle')
    : false;
  const isFocusedRecordTask = !activeCategoryIsCharacterLike
    ? Boolean(
        draft.recordAuthoringMode !== 'idle' ||
          (editingId && selectedEntity?.categoryId === activeCategory?.id)
      )
    : false;
  // The create/import panel shows only on the record list, not over an open record.
  const isRecordEditorOpen = isFocusedCharacterTask || isFocusedRecordTask;
  const {
    reviewQueue,
    filteredReviewQueue,
    potentialEntityMatches,
    reviewEntityInsightsById,
    visibleEntities,
    selectedEntityQueueItem
  } = useWorldBibleReview({
    entities,
    aliases,
    categories,
    aliasMapByEntityId,
    activeTab,
    viewMode,
    reviewFilter,
    recommendedFilter,
    editingId,
    name,
    fieldValues,
    selectedEntity,
    alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
    ignoredEntityMatchKeys,
    normalizeName,
    parseAlternativeNames
  });

  const resetForm = () => {
    draft.reset();
    resetAiHelpers();
  };

  const handleSelectCategoryTab = (categoryId: string) => {
    setViewMode('category');
    setActiveTab(categoryId);
    resetForm();
  };

  const handleSelectReview = () => { setViewMode('review'); resetForm(); };

  const startNewCharacterCanonRecord = () => {
    if (characterCategory) {
      setViewMode('category');
      setActiveTab(characterCategory.id);
    }
    draft.startCharacter();
    closeRecordAiHelper();
  };

  const startNewCategoryRecord = () => {
    if (!activeCategory) return;
    setViewMode('category');
    draft.startRecord();
    closeRecordAiHelper();
  };

  const {edit: editDraft} = draft;
  const handleEdit = useCallback((entity: WorldEntity, focus: RecordReviewFocus = 'general') => {
    editDraft(entity, focus);
    clearAiHelperDraft();
  }, [clearAiHelperDraft, editDraft]);

  const handleOpenReviewItem = useCallback(
    (entity: WorldEntity, focus: RecordReviewFocus = 'general') => {
      setViewMode('category');
      setActiveTab(entity.categoryId);
      handleEdit(entity, focus);
    },
    [handleEdit, setActiveTab, setViewMode]
  );

  const hasRuleset = Boolean(activeProject?.rulesetId);

  const entityActions = useWorldBibleEntityActions({
    requestConfirm,
    activeProject,
    activeCategory: activeCategory ?? null,
    categories,
    entities,
    characters,
    setCharacters,
    setEntities,
    setAliases,
    setFeedback,
    setViewMode,
    setCanonState,
    ragService,
    shodhService,
    refreshMemories,
    editingId,
    name,
    fieldValues,
    systemNegativeSpace: draft.systemNegativeSpace,
    viewMode,
    selectedEntityQueueItem,
    filteredReviewQueue,
    aliasMapByEntityId,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds,
    hasRuleset,
    seriesParentProjectId: seriesConfig?.parentProjectId ?? null,
    normalizeName,
    parseAlternativeNames,
    formatAlternativeNames,
    buildEntityContent: buildWorldBibleEntityContent,
    alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
    openReviewItem: handleOpenReviewItem,
    handleEdit,
    resetForm,
    navigate: (to, options) => navigate(to, options as never)
  });
  const {saveEntityDraft, isSyncingCanon, handleCanonSync} = entityActions;

  const resolution = useWorldBibleRecordResolution({
    activeProject,
    projectSettings,
    saveProjectSettings,
    activeCategoryIsCharacterLike,
    activeTab,
    draft,
    selectedEntity,
    selectedEntityAliases,
    entities,
    setEntities,
    categories,
    potentialEntityMatches,
    setActiveTab,
    setFeedback,
    ragService,
    shodhService,
    refreshMemories,
    handleEdit,
    saveEntityDraft
  });

  useWorldBibleLocationFocus({
    location,
    categories,
    entities,
    activeTab,
    setActiveTab,
    setViewMode,
    isPasteImportOpen: draft.isPasteImportOpen,
    setIsPasteImportOpen: draft.setIsPasteImportOpen,
    startCanvasProposal: draft.startCanvasProposal,
    handleEdit,
    setCharacterDetailSection: draft.setCharacterDetailSection,
    setHandoffGuidance: resolution.setHandoffGuidance
  });

  const openCharacterFromDescription = (entityId: string) =>
    navigate('/world-bible', {state: {focusEntityId: entityId, focusCharacterSection: 'notes'}});

  const handleOpenImportedEntity = (entityId: string, saved?: WorldEntity) => {
    const entity = entities.find((item) => item.id === entityId) ?? saved;
    if (!entity) return;
    setViewMode('category');
    setActiveTab(entity.categoryId);
    handleEdit(entity);
    setImportOpenRequest((count) => count + 1);
  };

  if (!activeProject) {
    return (
      <section className={styles.noProject}>
        <h1>World Bible</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <PageHeader
        eyebrow='Structured canon'
        title='World Bible'
        description='Keep canonical names, aliases, and structured story facts here. Use Source Notes for longform dossiers and background material.'
        actions={
          <>
            <ProjectScratchpadButton projectId={activeProject.id} />
            <button
              type='button'
              className={styles.categoryRailToggle}
              onClick={toggleCategoryRail}
            >
              {isCategoryRailCollapsed ? 'Show categories' : 'Hide categories'}
            </button>
          </>
        }
      />
      <div
        className={`${styles.routeShell} ${
          isCategoryRailCollapsed ? styles.routeShellRailCollapsed : ''
        }`}
      >
        <WorldBibleCategoryRail
          isCollapsed={isCategoryRailCollapsed} categories={worldBibleCategories}
          viewMode={viewMode} activeTab={activeTab}
          reviewCount={reviewQueue.length + characterIdentityResolution.queue.length}
          showCategoryManager={showCategoryManager}
          isImportingEntities={isImportingEntities} isImportingJson={isImportingJson}
          importInputRef={importInputRef} jsonImportInputRef={jsonImportInputRef}
          onSelectCategory={handleSelectCategoryTab}
          onSelectReview={handleSelectReview}
          onToggleCategoryManager={() => setShowCategoryManager((value) => !value)}
          onDownloadJsonTemplate={() => {
            if (activeCategory) downloadWorldBibleJsonTemplate(activeCategory);
          }}
          onDownloadJsonSample={() => {
            if (activeCategory) downloadWorldBibleJsonSample(activeCategory);
          }}
        />

        <div className={styles.mainColumn}>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      {seriesConfig?.parentProjectId && (
        <WorldBibleParentCanonBanner
          canonState={canonState}
          isSyncing={isSyncingCanon}
          onMarkSynced={() => void handleCanonSync()}
        />
      )}

      {viewMode === 'review' && (
        <CharacterIdentityResolutionQueue
          items={characterIdentityResolution.queue} canonicalCharacters={characterIdentityResolution.canonicalCharacters}
          resolvingKey={characterIdentityResolution.resolvingKey} onLink={characterIdentityResolution.linkToCanon}
          onCreateCanon={characterIdentityResolution.createCanon} onKeepSeparate={characterIdentityResolution.keepSeparate}
          canonReviewItems={filteredReviewQueue} onOpenCanonReview={handleOpenReviewItem}
        />
      )}


      {activeCategory && viewMode === 'category' && !isRecordEditorOpen && (
        <WorldBibleCategoryOverview
          category={activeCategory}
          aiCoaching={aiCoaching}
          isImportingEntities={isImportingEntities}
          onCreateManually={
            activeCategoryIsCharacterLike ? startNewCharacterCanonRecord : startNewCategoryRecord
          }
          onStartCharacterIntake={setCharacterIntake}
          onImportDocs={() => importInputRef.current?.click()}
          onPasteText={() => draft.setIsPasteImportOpen(true)}
        />
      )}

      <WorldBibleImportWorkspace
        activeProject={activeProject} projectSettings={projectSettings}
        activeCategory={activeCategory} categories={categories} categoryById={categoryById}
        imports={worldBibleImports} authoring={worldBibleAuthoring}
        isPasteImportOpen={draft.isPasteImportOpen} setIsPasteImportOpen={draft.setIsPasteImportOpen}
        pastedImportText={draft.pastedImportText} setPastedImportText={draft.setPastedImportText}
        importInputRef={importInputRef} jsonImportInputRef={jsonImportInputRef}
        onOpenImportedEntity={handleOpenImportedEntity}
      />
      {showCategoryManager && (
        <CategoryManager
          projectId={activeProject.id}
          categories={worldBibleCategories}
          canAddSystemNegativeSpace={showGameSystems}
          onCategoriesChange={(updatedCategories) => {
            const hiddenCategories = categories.filter(
              (category) => !worldBibleCategories.some(
                (visibleCategory) => visibleCategory.id === category.id
              )
            );
            setCategories([...updatedCategories, ...hiddenCategories]);
          }}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {activeCategory && (
        <div
          className={`${shared.content} ${shared.castContent}`}
        >
          {isRecordEditorOpen && (
            <WorldBibleRecordEditor
              activeProject={activeProject}
              projectSettings={projectSettings}
              category={activeCategory}
              isCharacterLike={activeCategoryIsCharacterLike}
              categories={categories}
              entities={entities}
              writingDocuments={writingDocuments}
              draft={draft}
              selection={selection}
              authoring={worldBibleAuthoring}
              resolution={resolution}
              entityActions={entityActions}
              currentEntityMemories={currentEntityMemories}
              refreshMemories={refreshMemories}
              seriesParentProjectId={seriesConfig?.parentProjectId ?? null}
              canProbe={Boolean(ragService)}
              canUseMechanics={showCharacterMechanics}
              aiCoaching={aiCoaching}
              ruleset={ruleset}
              hasRuleset={hasRuleset}
              setRuleset={setRuleset}
              setCharacterSheets={setCharacterSheets}
              setCharacters={setCharacters}
              setFeedback={setFeedback}
              worldCanvas={worldCanvas}
              scrollRequest={importOpenRequest}
              onCancel={resetForm}
              onEdit={handleEdit}
              onOpenLab={setLabEntityId}
              navigate={navigate}
            />
          )}

          {activeCategoryIsSystemNegativeSpace && !isFocusedRecordTask && (
            <SystemNegativeSpacePanel
              categoryId={activeCategory.id}
              entities={entities}
              documents={writingDocuments}
              editing={false}
              status='open'
              sceneIds={[]}
              onStatusChange={() => undefined}
              onSceneIdsChange={() => undefined}
              onOpenScene={(sceneId) => navigate('/workspace', {
                state: {focusDocumentId: sceneId}
              })}
            />
          )}
          <WorldBibleEntityList
            viewMode={viewMode} activeCategoryIsCharacterLike={activeCategoryIsCharacterLike}
            isFocusedCharacterTask={isFocusedCharacterTask}
            isFocusedRecordTask={isFocusedRecordTask} activeCategory={activeCategory}
            categories={worldBibleCategories} visibleEntities={visibleEntities}
            reviewEntityInsightsById={reviewEntityInsightsById} reviewQueue={reviewQueue}
            aliasMapByEntityId={aliasMapByEntityId}
            linkedLoreDocumentByEntityId={linkedLoreDocumentByEntityId}
            linkingLoreEntityId={linkingLoreEntityId}
            compendiumLinkedEntityIds={compendiumLinkedEntityIds}
            seriesParentProjectId={seriesConfig?.parentProjectId ?? null}
            showCharacterMechanics={showCharacterMechanics} showGameSystems={showGameSystems}
            hasRuleset={hasRuleset}
            actions={entityActions}
            handleEdit={handleEdit}
            handleOpenCharacterWritingAids={(entity) => {
              handleEdit(entity);
              draft.setCharacterDetailSection('writing-aids');
            }}
            handleOpenOrCreateLinkedLoreDocument={handleOpenOrCreateLinkedLoreDocument}
          />
        </div>
      )}
        </div>
      </div>

      <CharacterIntakeDialog
        kind={characterIntake}
        projectId={activeProject.id}
        category={activeCategory ? {id: activeCategory.id, slug: activeCategory.slug} : null}
        onOpenCharacter={openCharacterFromDescription}
        onClose={() => setCharacterIntake(null)}
      />

      {labEntityId && (
        <CharacterLabDialog
          isOpen
          projectId={activeProject.id}
          entityId={labEntityId}
          defaultPosition={LATEST_POSITION}
          onClose={() => setLabEntityId(null)}
        />
      )}

      {confirmDialog}
    </section>
  );
}
export default WorldBibleRoute;
