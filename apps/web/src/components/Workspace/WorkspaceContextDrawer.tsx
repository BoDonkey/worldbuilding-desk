import {useNavigate} from 'react-router-dom';
import {clearSystemHistoryEntries} from '../../services/system';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  ProjectSettings,
  StoredRuleset,
  SystemHistoryEntry,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {LoreInspectorPanel} from '../Editor/LoreInspectorPanel';
import type {LoreInspectorRecord} from '../Editor/LoreInspectorPanel';
import {SystemHistoryPanel} from '../Editor/SystemHistoryPanel';
import {ShodhMemoryPanel} from '../ShodhMemoryPanel';
import type {MemoryEntry} from '../../services/shodh/ShodhMemoryService';
import type {WorkspaceContextDrawerView} from '../../hooks/useWorkspaceDrawers';
import styles from '../../styles/WorkspaceRoute.module.css';

interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: {
    code: string;
    message: string;
    relatedEntities?: Array<{id: string; name: string; type: 'character' | 'entity'}>;
  };
}

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
}

interface WorkspaceContextDrawerProps {
  activeContextView: WorkspaceContextDrawerView;
  setActiveContextView: (view: WorkspaceContextDrawerView) => void;
  showGameSystems: boolean;

  // World-bible view
  entities: WorldEntity[];
  categories: EntityCategory[];

  // Ruleset view
  ruleset: StoredRuleset | null;

  // Characters view
  characters: Character[];
  characterSheets: CharacterSheet[];

  // Review view
  handleRunConsistencyReview: () => Promise<void>;
  isRunningConsistencyReview: boolean;
  lastConsistencyReviewAt: number | null;
  consistencyReviewItems: ConsistencyReviewItem[];
  documents: WritingDocument[];
  handleSelectDocument: (doc: WritingDocument) => void;
  openWorldRecord: (target: {id: string; type: 'character' | 'entity'}) => void;

  // AI view
  activeProject: {id: string};
  projectSettings: ProjectSettings | null;
  activeAIContext: AIContext | null;
  setPendingAIInsert: (val: PendingAIInsert | null) => void;
  queuedAssistantPrompt: string | null;
  setQueuedAssistantPrompt: (val: string | null) => void;

  // System history view
  systemHistoryEntries: SystemHistoryEntry[];
  setFeedback: (val: {tone: 'success' | 'error'; message: string} | null) => void;
  refreshSystemHistory: () => void;

  // Lore view
  activeLoreRecord: LoreInspectorRecord | null;
  aiBudgetUsed: number;
  handleConsultationFromLore: (
    mode: 'consistency' | 'reaction' | 'outcome' | 'worldbuilding' | 'plotting'
  ) => void;

  // Compendium view (summary counts only)
  settlementModuleCount: number;
  activePartySynergyCount: number;

  // ShodhMemoryPanel (shown when a document is selected)
  selectedId: string | null;
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
  {id: 'world-bible', label: 'World Bible'},
  {id: 'ruleset', label: 'Ruleset'},
  {id: 'characters', label: 'Characters'},
  {id: 'compendium', label: 'Compendium'},
  {id: 'review', label: 'Review'},
  {id: 'ai', label: 'AI'},
  {id: 'system', label: 'System'},
  {id: 'lore', label: 'Lore'}
];

export function WorkspaceContextDrawer({
  activeContextView,
  setActiveContextView,
  showGameSystems,
  entities,
  categories,
  ruleset,
  characters,
  characterSheets,
  handleRunConsistencyReview,
  isRunningConsistencyReview,
  lastConsistencyReviewAt,
  consistencyReviewItems,
  documents,
  handleSelectDocument,
  openWorldRecord,
  activeProject,
  projectSettings,
  activeAIContext,
  setPendingAIInsert,
  queuedAssistantPrompt,
  setQueuedAssistantPrompt,
  systemHistoryEntries,
  setFeedback,
  refreshSystemHistory,
  activeLoreRecord,
  aiBudgetUsed,
  handleConsultationFromLore,
  settlementModuleCount,
  activePartySynergyCount,
  selectedId,
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

  const visibleTabs = CONTEXT_DRAWER_TABS.filter(
    (tab) => tab.id !== 'compendium' || showGameSystems
  );

  const content = (() => {
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
            Characters: <strong>{characters.length}</strong> · Sheets:{' '}
            <strong>{characterSheets.length}</strong>
          </p>
          <button type='button' onClick={() => navigate('/characters')}>
            Open Characters
          </button>
        </div>
      );
    }
    if (activeContextView === 'review') {
      return (
        <div className={styles.contextSummary}>
          <div className={styles.contextSummaryText}>
            <strong>Canon Consistency Review</strong>
            <div className={styles.consistencyDescription}>
              Run review when you want a canon check, not on every glance at the page.
            </div>
          </div>
          <div className={styles.consistencyPanelHeader}>
            <button
              type='button'
              onClick={() => void handleRunConsistencyReview()}
              disabled={isRunningConsistencyReview}
            >
              {isRunningConsistencyReview ? 'Running review...' : 'Run review'}
            </button>
          </div>
          {lastConsistencyReviewAt && (
            <div className={styles.consistencyLastRun}>
              Last run: {new Date(lastConsistencyReviewAt).toLocaleString()}
            </div>
          )}
          {consistencyReviewItems.length > 0 ? (
            <ul className={styles.consistencyList}>
              {consistencyReviewItems.slice(0, 24).map((item) => (
                <li key={item.id} className={styles.consistencyListItem}>
                  <strong>{item.issue.code}</strong> in{' '}
                  <button
                    type='button'
                    onClick={() => {
                      const doc = documents.find((entry) => entry.id === item.sceneId);
                      if (doc) handleSelectDocument(doc);
                    }}
                    className={styles.consistencySceneButton}
                  >
                    {item.sceneTitle}
                  </button>
                  : {item.issue.message}
                  {item.issue.relatedEntities && item.issue.relatedEntities.length > 0 && (
                    <span className={styles.consistencyRelated}>
                      {item.issue.relatedEntities.slice(0, 3).map((target) => (
                        <button
                          key={`${item.id}-${target.id}`}
                          type='button'
                          onClick={() => openWorldRecord(target)}
                          className={styles.consistencyRelatedButton}
                        >
                          Open {target.name}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.contextSummaryText}>No open review items.</p>
          )}
        </div>
      );
    }
    if (activeContextView === 'ai') {
      return (
        <AIAssistant
          projectId={activeProject.id}
          aiConfig={projectSettings?.aiSettings}
          projectMode={projectSettings?.projectMode}
          context={activeAIContext ?? undefined}
          onInsert={(text) =>
            setPendingAIInsert({
              text,
              context:
                activeAIContext && activeAIContext.from !== activeAIContext.to
                  ? {from: activeAIContext.from, to: activeAIContext.to}
                  : null
            })
          }
          queuedPrompt={queuedAssistantPrompt}
          onQueuedPromptConsumed={() => setQueuedAssistantPrompt(null)}
          consultationModel={projectSettings?.aiSettings?.inspectorSettings?.lowCostModel}
          consultationMaxTokens={
            projectSettings?.aiSettings?.inspectorSettings?.maxResponseTokens
          }
        />
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
            void handleRunConsistencyReview();
          }}
        />
      );
    }
    if (activeContextView === 'lore') {
      return (
        <LoreInspectorPanel
          record={activeLoreRecord}
          aiEnabled={
            projectSettings?.aiSettings?.inspectorSettings?.enableAIConsultation !== false
          }
          aiBudgetUsed={aiBudgetUsed}
          aiBudgetMax={projectSettings?.aiSettings?.inspectorSettings?.maxConsultationsPerDay ?? 20}
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
          Open Compendium
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
              className={styles.contextTabButton}
              style={{
                backgroundColor:
                  tab.id === activeContextView ? '#dbeafe' : 'transparent'
              }}
            >
              {tab.label}
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
