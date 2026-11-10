import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router';
import {clearSystemHistoryEntries} from '../../services/system';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  StoredRuleset,
  SystemHistoryEntry,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {LoreInspectorPanel} from '../Editor/LoreInspectorPanel';
import type {UseConsultationBudget} from '../../hooks/useConsultationBudget';
import type {LoreInspectorRecord} from '../../services/workspace/workspaceConsultation';
import {SourceNoteCapturePreview} from '../Editor/SourceNoteCapturePreview';
import {SystemHistoryPanel} from '../Editor/SystemHistoryPanel';
import type {RAGProvider} from '../../services/rag/RAGService';
import {ShodhMemoryPanel} from '../ShodhMemoryPanel';
import TipTapEditor from '../TipTapEditor';
import type {MemoryEntry} from '../../services/shodh/ShodhMemoryService';
import type {WorkspaceContextDrawerView} from '../../hooks/useWorkspaceDrawers';
import {normalizeRichTextValue} from '../../services/worldBible/worldBibleEntityHelpers';
import styles from '../../styles/WorkspaceRoute.module.css';
import {SceneRosterPanel} from './SceneRosterPanel';
import type {
  SceneRosterAddOption,
  SceneRosterCharacterCard,
  SceneRosterItemCard,
  SceneRosterTimelineEvent
} from '../../services/workspace/sceneRosterTypes';
import type {AITextProvenance} from '../../services/editor/aiTextProvenance';
import {useModelCanonCheck} from '../../hooks/useModelCanonCheck';
import {sceneCheckText} from '../../services/consistency/modelCanonCheck';
import {WorkspaceReviewTab, type WorkspaceReviewInputs} from './WorkspaceReviewTab';
import {anyAISwitchOn, readAISwitches} from '../../services/llm/aiSwitches';
import {WorkspaceCharacterLabSection} from './WorkspaceCharacterLabSection';

interface AIContext {
  type: 'document';
  id: string;
  selectedText?: string;
  from: number;
  to: number;
}

interface PendingAIInsert {
  text: string;
  context: {from: number; to: number} | null;
  provenance?: AITextProvenance;
}

interface WorkspaceContextDrawerProps {
  activeContextView: WorkspaceContextDrawerView;
  setActiveContextView: (view: WorkspaceContextDrawerView) => void;
  showGameSystems: boolean;
  showRuleAuthoring: boolean;

  // World-bible view
  entities: WorldEntity[];
  categories: EntityCategory[];

  // Ruleset view
  ruleset: StoredRuleset | null;

  // Characters view
  characters: Character[];
  characterSheets: CharacterSheet[];
  onOpenCharacterLab: (entityId: string) => void;
  onOpenCharacterScene: (entityId: string) => void;

  // Current scene roster view
  sceneRosterTitle: string | null;
  sceneRosterCharacters: SceneRosterCharacterCard[];
  sceneRosterItems: SceneRosterItemCard[];
  sceneRosterAddOptions: SceneRosterAddOption[];
  sceneRosterAmbiguousSurfaces: string[];
  addSceneRosterEntry: (candidateKey: string) => void;
  hideSceneRosterEntry: (candidateKey: string) => void;
  sceneRosterStateMoment: 'opening' | 'cursor' | 'ending';
  sceneRosterCursorPosition: number;
  setSceneRosterStateMoment: (moment: 'opening' | 'cursor' | 'ending') => void;
  recordSceneRosterChangeHere: (character: SceneRosterCharacterCard) => void;
  consumeSceneRosterItemHere: Parameters<typeof SceneRosterPanel>[0]['onConsumeHere'];
  sceneRosterTimeline: SceneRosterTimelineEvent[];
  editSceneRosterTimelineEvent: (eventId: string) => void;
  invalidateSceneRosterTimelineEvent: (eventId: string) => void;
  reanchorSceneRosterTimelineEvent: (eventId: string) => void;
  expireSceneRosterTimelineEvent: (eventId: string) => void;

  // Review view
  review: WorkspaceReviewInputs;
  documents: WritingDocument[];
  handleSelectDocument: (doc: WritingDocument) => void;
  openWorldRecord: (target: {id: string; type: 'character' | 'entity'}) => void;

  // Scratchpad view
  scratchpadContent: string;
  setScratchpadContent: (content: string) => void;
  scratchpadStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  scratchpadLastSavedAt: number | null;

  // AI view
  activeProject: Pick<Project, 'id' | 'parentProjectId' | 'inheritRag' | 'inheritShodh'>;
  projectSettings: ProjectSettings | null;
  activeAIContext: AIContext | null;
  clearAIContext: () => void;
  previewSceneRevision: (text: string, provenance?: AITextProvenance) => void;
  setPendingAIInsert: (val: PendingAIInsert | null) => void;
  queuedAssistantPrompt: string | null;
  setQueuedAssistantPrompt: (val: string | null) => void;
  ragService: RAGProvider | null;

  // System history view
  systemHistoryEntries: SystemHistoryEntry[];
  setFeedback: (val: {tone: 'success' | 'error'; message: string} | null) => void;
  refreshSystemHistory: () => void;

  // Lore view
  activeLoreRecord: LoreInspectorRecord | null;
  consultationBudget: UseConsultationBudget;
  handleConsultationFromLore: (
    mode: 'consistency' | 'reaction' | 'outcome' | 'worldbuilding' | 'plotting'
  ) => void;

  // Compendium view (summary counts only)
  settlementModuleCount: number;
  activePartySynergyCount: number;

  // ShodhMemoryPanel (shown when a document is selected)
  selectedId: string | null;
  /** The open scene as edited, for the model-assisted canon check. */
  sceneContent: string;
  memoryCandidates: MemoryEntry[];
  memoryFilter: string;
  setMemoryFilter: (val: string) => void;
  memoryScope: 'document' | 'project';
  setMemoryScope: (val: 'document' | 'project') => void;
  scopeLabel: string;
  refreshMemories: () => Promise<void>;
  handleDeleteMemory: (id: string) => Promise<void>;
  emptyMemoryMessage: string;
  seriesBibleConfig: {parentProjectId?: string} | null;
  handlePromoteMemory: (memory: MemoryEntry) => Promise<void>;
  isPromotingMemoryId: string | null;
}

const MEMORIES_PER_PAGE = 5;

const CONTEXT_DRAWER_TABS: Array<{id: WorkspaceContextDrawerView; label: string}> = [
  {id: 'scene-roster', label: 'Scene'},
  {id: 'world-bible', label: 'World Bible'},
  {id: 'ruleset', label: 'Rules'},
  {id: 'characters', label: 'Characters'},
  {id: 'compendium', label: 'Mechanics'},
  {id: 'review', label: 'Review'},
  {id: 'scratchpad', label: 'Scratchpad'},
  {id: 'ai', label: 'AI'},
  {id: 'system', label: 'System'},
  {id: 'lore', label: 'Source Notes'}
];

export function WorkspaceContextDrawer({
  activeContextView,
  setActiveContextView,
  showGameSystems,
  showRuleAuthoring,
  entities,
  categories,
  ruleset,
  characters,
  characterSheets,
  onOpenCharacterLab,
  onOpenCharacterScene,
  sceneRosterTitle,
  sceneRosterCharacters,
  sceneRosterItems,
  sceneRosterAddOptions,
  sceneRosterAmbiguousSurfaces,
  addSceneRosterEntry,
  hideSceneRosterEntry,
  sceneRosterStateMoment,
  sceneRosterCursorPosition,
  setSceneRosterStateMoment,
  recordSceneRosterChangeHere,
  consumeSceneRosterItemHere,
  sceneRosterTimeline,
  editSceneRosterTimelineEvent,
  invalidateSceneRosterTimelineEvent,
  reanchorSceneRosterTimelineEvent,
  expireSceneRosterTimelineEvent,
  review,
  documents,
  handleSelectDocument,
  openWorldRecord,
  scratchpadContent,
  setScratchpadContent,
  scratchpadStatus,
  scratchpadLastSavedAt,
  activeProject,
  projectSettings,
  activeAIContext,
  clearAIContext,
  setPendingAIInsert,
  previewSceneRevision,
  queuedAssistantPrompt,
  setQueuedAssistantPrompt,
  ragService,
  systemHistoryEntries,
  setFeedback,
  refreshSystemHistory,
  activeLoreRecord,
  consultationBudget,
  handleConsultationFromLore,
  settlementModuleCount,
  activePartySynergyCount,
  selectedId,
  sceneContent,
  memoryCandidates,
  memoryFilter,
  setMemoryFilter,
  memoryScope,
  setMemoryScope,
  scopeLabel,
  refreshMemories,
  handleDeleteMemory,
  emptyMemoryMessage,
  seriesBibleConfig,
  handlePromoteMemory,
  isPromotingMemoryId
}: WorkspaceContextDrawerProps) {
  const navigate = useNavigate();
  const [expandedReviewActionId, setExpandedReviewActionId] = useState<string | null>(null);
  const [rejectedAliasSuggestions, setRejectedAliasSuggestions] = useState<
    Record<string, string[]>
  >({});
  const [pendingSourceNoteCapture, setPendingSourceNoteCapture] = useState<string | null>(null);
  const [assistantSessionId] = useState(() => crypto.randomUUID());
  const aiSwitches = readAISwitches(projectSettings?.aiSettings);
  const anyAIOn = anyAISwitchOn(aiSwitches);

  const visibleTabs = useMemo(
    () =>
      CONTEXT_DRAWER_TABS.filter(
        (tab) =>
          (tab.id !== 'compendium' || showGameSystems) &&
          (tab.id !== 'ruleset' || showRuleAuthoring) &&
          (tab.id !== 'ai' || anyAIOn)
      ),
    [showGameSystems, showRuleAuthoring, anyAIOn]
  );
  const currentDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId]
  );
  const currentSceneCheckText = useMemo(() => sceneCheckText(sceneContent), [sceneContent]);
  const canonCheck = useModelCanonCheck({
    projectId: activeProject.id,
    aiSettings: projectSettings?.aiSettings,
    scene: currentDocument
      ? {id: currentDocument.id, title: currentDocument.title, text: currentSceneCheckText}
      : null,
    documents,
    onAddItems: review.consistency.addModelCheckItems
  });
  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeContextView)) {
      setActiveContextView('world-bible');
    }
  }, [activeContextView, setActiveContextView, visibleTabs]);
  const content = (() => {
    if (activeContextView === 'scene-roster') {
      return (
        <SceneRosterPanel
          sceneTitle={sceneRosterTitle}
          characters={sceneRosterCharacters}
          items={sceneRosterItems}
          addOptions={sceneRosterAddOptions}
          ambiguousSurfaces={sceneRosterAmbiguousSurfaces}
          onAdd={addSceneRosterEntry}
          onHide={hideSceneRosterEntry}
          onOpenRecord={openWorldRecord}
          stateMoment={sceneRosterStateMoment}
          cursorPosition={sceneRosterCursorPosition}
          onStateMomentChange={setSceneRosterStateMoment}
          onRecordChangeHere={recordSceneRosterChangeHere}
          onConsumeHere={consumeSceneRosterItemHere}
          timeline={sceneRosterTimeline}
          onEditTimelineEvent={editSceneRosterTimelineEvent}
          onInvalidateTimelineEvent={invalidateSceneRosterTimelineEvent}
          onReanchorTimelineEvent={reanchorSceneRosterTimelineEvent}
          onExpireTimelineEvent={expireSceneRosterTimelineEvent}
        />
      );
    }
    if (activeContextView === 'world-bible') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Entities: <strong>{entities.length}</strong> · Categories:{' '}
            <strong>{categories.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/world-bible')}>
            Open World Bible
          </button>
        </div>
      );
    }
    if (activeContextView === 'ruleset') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Stats: <strong>{ruleset?.statDefinitions.length ?? 0}</strong> · Resources:{' '}
            <strong>{ruleset?.resourceDefinitions.length ?? 0}</strong> · Rules:{' '}
            <strong>{ruleset?.rules.length ?? 0}</strong>
          </p>
          <button type='button' onClick={() => navigate('/ruleset')}>
            Open Ruleset
          </button>
        </div>
      );
    }
    if (activeContextView === 'characters') {
      return (
        <div className={styles.contextSummary}>
          <p className={styles.contextSummaryText}>
            Roster: <strong>{characters.length}</strong> · Sheets:{' '}
            <strong>{characterSheets.length}</strong>
          </p>
          <button
            type='button'
            onClick={() =>
              navigate('/world-bible', {state: {focusCategorySlug: 'characters'}})
            }
          >
            Open World Bible characters
          </button>
          <WorkspaceCharacterLabSection
            entities={entities}
            categories={categories}
            switches={aiSwitches}
            onOpenCharacterLab={onOpenCharacterLab}
            onOpenCharacterScene={onOpenCharacterScene}
          />
        </div>
      );
    }
    if (activeContextView === 'review') {
      return (
        <WorkspaceReviewTab
          review={review}
          tabState={{
            canonCheck,
            expandedReviewActionId,
            setExpandedReviewActionId,
            rejectedAliasSuggestions,
            setRejectedAliasSuggestions
          }}
          categories={categories}
          documents={documents}
          selectedId={selectedId}
          currentDocument={currentDocument}
          handleSelectDocument={handleSelectDocument}
          openWorldRecord={openWorldRecord}
        />
      );
    }
    if (activeContextView === 'ai') {
      return (
        <>
          <AIAssistant
            projectId={activeProject.id}
            parentProjectId={activeProject.parentProjectId}
            inheritRag={activeProject.inheritRag}
            inheritShodh={activeProject.inheritShodh}
            aiConfig={projectSettings?.aiSettings}
            projectMode={projectSettings?.projectMode}
            context={activeAIContext ?? undefined}
            onClearContext={clearAIContext}
            onInsert={previewSceneRevision}
            onCaptureSourceNote={setPendingSourceNoteCapture}
            sceneText={currentDocument?.content}
            queuedPrompt={queuedAssistantPrompt}
            onQueuedPromptConsumed={() => setQueuedAssistantPrompt(null)}
            consultationModel={projectSettings?.aiSettings?.inspectorSettings?.lowCostModel}
            consultationMaxTokens={
              projectSettings?.aiSettings?.inspectorSettings?.maxResponseTokens
            }
          />
          {pendingSourceNoteCapture !== null && (
            <SourceNoteCapturePreview
              projectId={activeProject.id}
              sessionId={assistantSessionId}
              text={pendingSourceNoteCapture}
              ragService={ragService}
              onClose={() => setPendingSourceNoteCapture(null)}
              onCaptured={(title) =>
                setFeedback({
                  tone: 'success',
                  message: `Saved "${title}" as a draft Source Note. Review and extract it from Source Notes when ready.`
                })
              }
            />
          )}
        </>
      );
    }
    if (activeContextView === 'scratchpad') {
      return (
        <div className={styles.contextSummary}>
          <div className={styles.contextSummaryText}>
            <strong>Scratchpad</strong>
            <div className={styles.consistencyDescription}>
              Private project notes that stay out of scenes and canon.
            </div>
          </div>
          <div className={styles.scratchpadEditorShell} aria-label='Project scratchpad'>
            <TipTapEditor
              content={normalizeRichTextValue(scratchpadContent)}
              onChange={setScratchpadContent}
            />
          </div>
          <div className={styles.scratchpadStatus} role='status'>
            {scratchpadStatus === 'loading'
              ? 'Loading scratchpad...'
              : scratchpadStatus === 'saving'
                ? 'Saving scratchpad...'
                : scratchpadStatus === 'error'
                  ? 'Scratchpad could not be saved.'
                  : scratchpadLastSavedAt
                    ? `Scratchpad saved at ${new Date(scratchpadLastSavedAt).toLocaleTimeString()}`
                    : 'Scratchpad ready.'}
          </div>
        </div>
      );
    }
    if (activeContextView === 'system') {
      return (
        <SystemHistoryPanel
          entries={systemHistoryEntries}
          onInsertEntry={(entry) =>
            setPendingAIInsert({
              text: entry.insertText,
              context: null
            })
          }
          onClear={() => {
            clearSystemHistoryEntries(activeProject.id);
            refreshSystemHistory();
            setFeedback({tone: 'success', message: 'System history cleared.'});
          }}
          onOpenScene={(sceneId) => {
            const doc = documents.find((entry) => entry.id === sceneId);
            if (doc) {
              handleSelectDocument(doc);
              return;
            }
            setFeedback({
              tone: 'error',
              message: 'Could not open scene for this system event.'
            });
          }}
          onRunConsistencyReview={() => {
            void review.onRunReview();
          }}
        />
      );
    }
    if (activeContextView === 'lore') {
      return (
        <LoreInspectorPanel
          record={activeLoreRecord}
          onEditRecord={openWorldRecord}
          aiEnabled={aiSwitches.coaching}
          budget={consultationBudget}
          onConsult={handleConsultationFromLore}
        />
      );
    }
    return (
      <div className={styles.contextSummary}>
        <p className={styles.contextSummaryText}>
          Modules: <strong>{settlementModuleCount}</strong> · Party synergies:{' '}
          <strong>{activePartySynergyCount}</strong>
        </p>
        <button type='button' onClick={() => navigate('/compendium')}>
          Open Mechanics
        </button>
      </div>
    );
  })();

  return (
    <>
      <div className={styles.contextCard}>
        <div className={styles.contextTabs}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setActiveContextView(tab.id)}
              className={`${styles.contextTabButton} ${
                tab.id === activeContextView ? styles.contextTabButtonActive : ''
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'review' && review.consistency.reviewReadiness.count > 0 && (
                <span className={styles.contextTabBadge}>
                  {review.consistency.reviewReadiness.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.contextContent}>{content}</div>
      </div>

      {selectedId && (
        <ShodhMemoryPanel
          title='Canon memories'
          memories={memoryCandidates}
          filterValue={memoryFilter}
          onFilterChange={setMemoryFilter}
          scopeSelector={{
            label: 'Scope',
            value: memoryScope,
            options: [
              {value: 'document', label: 'This scene'},
              {value: 'project', label: 'All project'}
            ],
            onChange: (value) => setMemoryScope(value as 'document' | 'project')
          }}
          scopeSummaryLabel={scopeLabel}
          highlightDocumentId={selectedId}
          onRefresh={() => void refreshMemories()}
          pageSize={MEMORIES_PER_PAGE}
          showDelete
          onDeleteMemory={(id) => {
            void handleDeleteMemory(id);
          }}
          emptyState={emptyMemoryMessage}
          renderSourceLabel={(memory) =>
            memory.projectId === activeProject.id ? 'Local' : 'Parent'
          }
          renderMemoryActions={(memory) => {
            if (seriesBibleConfig?.parentProjectId && memory.projectId === activeProject.id) {
              return (
                <button
                  type='button'
                  onClick={() => void handlePromoteMemory(memory)}
                  disabled={isPromotingMemoryId === memory.id}
                  style={{fontSize: '0.8rem'}}
                >
                  {isPromotingMemoryId === memory.id ? 'Promoting...' : 'Promote'}
                </button>
              );
            }
            return null;
          }}
        />
      )}
    </>
  );
}
