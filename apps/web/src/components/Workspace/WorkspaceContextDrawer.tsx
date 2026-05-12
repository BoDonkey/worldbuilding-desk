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
import type {
  ReviewReadiness,
  StateMutationReviewGroupHiddenCounts,
  StateMutationReviewItem
} from '../../hooks/useWorkspaceConsistency';
import type {ReviewIssueAnnotation} from '../../services/worldEngine';
import styles from '../../styles/WorkspaceRoute.module.css';

interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: {
    code: string;
    message: string;
    detectionReason?: string;
    relatedEntities?: Array<{id: string; name: string; type: 'character' | 'entity'}>;
  };
  reviewAnnotation?: ReviewIssueAnnotation;
}

const ISSUE_LABELS: Record<string, string> = {
  UNKNOWN_ENTITY: 'Unknown name',
  AMBIGUOUS_REFERENCE: 'Ambiguous reference',
  UNEXPECTED_SCENE_PRESENCE: 'Unexpected scene presence',
  STATE_CONFLICT: 'Canon conflict',
  INVALID_MUTATION: 'Invalid story state change'
};

const DETECTION_REASON_LABELS: Record<string, {label: string; title: string}> = {
  known_entity: {
    label: 'Known canon',
    title: 'This text already appears to match an existing world or character record.'
  },
  titled_name: {
    label: 'Titled name',
    title: 'This looks like a named person because it includes a title such as Dr., Captain, or Professor.'
  },
  repeated_unknown: {
    label: 'Repeated name',
    title: 'This unknown name appears more than once, so review treats it as likely story context.'
  },
  leading_entity_cue: {
    label: 'Context clue',
    title: 'Nearby wording suggests this may be a place, object, person, or other story-world term.'
  },
  character_context_candidate: {
    label: 'Character-like name',
    title: 'Sentence context suggests this unknown term may be a character name.'
  },
  multiword_proper_candidate: {
    label: 'Proper name',
    title: 'Capitalization and word shape suggest this may be a named story-world term.'
  },
  action_object_candidate: {
    label: 'Action object',
    title: 'The text uses this term like an object involved in an action.'
  }
};

const getIssueLabel = (code: string): string => ISSUE_LABELS[code] ?? 'Review item';

const getDetectionReason = (
  reason: string
): {label: string; title: string} =>
  DETECTION_REASON_LABELS[reason] ?? {
    label: 'Review clue',
    title: 'Review found a pattern that may need canon cleanup.'
  };

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
  stateMutationReviewItems: StateMutationReviewItem[];
  hiddenStateMutationReviewCountBySceneId: StateMutationReviewGroupHiddenCounts;
  hiddenStateMutationReviewCount: number;
  applyingStateMutationReviewId: string | null;
  reviewReadiness: ReviewReadiness;
  acceptStateMutationReviewItem: (eventId: string) => Promise<void>;
  rejectStateMutationReviewItem: (eventId: string) => Promise<void>;
  acceptSceneStateMutationReviewItems: (sceneId: string) => Promise<void>;
  rejectSceneStateMutationReviewItems: (sceneId: string) => Promise<void>;
  hideStateMutationReviewItem: (eventId: string) => void;
  restoreHiddenStateMutationReviewItems: (sceneId: string) => void;
  restoreAllHiddenStateMutationReviewItems: () => void;
  documents: WritingDocument[];
  handleSelectDocument: (doc: WritingDocument) => void;
  openWorldRecord: (target: {id: string; type: 'character' | 'entity'}) => void;

  // Scratchpad view
  scratchpadContent: string;
  setScratchpadContent: (content: string) => void;
  scratchpadStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  scratchpadLastSavedAt: number | null;

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
  {id: 'scratchpad', label: 'Scratchpad'},
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
  stateMutationReviewItems,
  hiddenStateMutationReviewCountBySceneId,
  hiddenStateMutationReviewCount,
  applyingStateMutationReviewId,
  reviewReadiness,
  acceptStateMutationReviewItem,
  rejectStateMutationReviewItem,
  acceptSceneStateMutationReviewItems,
  rejectSceneStateMutationReviewItems,
  hideStateMutationReviewItem,
  restoreHiddenStateMutationReviewItems,
  restoreAllHiddenStateMutationReviewItems,
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
  const stateMutationReviewGroups = stateMutationReviewItems.reduce<
    Array<{sceneId: string; sceneTitle: string; items: StateMutationReviewItem[]}>
  >((groups, item) => {
    const existing = groups.find((group) => group.sceneId === item.sceneId);
    if (existing) {
      existing.items.push(item);
      return groups;
    }
    groups.push({
      sceneId: item.sceneId,
      sceneTitle: item.sceneTitle,
      items: [item]
    });
    return groups;
  }, []);

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
            <strong>Project Review</strong>
            <div className={styles.consistencyDescription}>
              Scans every scene for names and canon references that are not already
              tracked. Known canon can underline while you type; new names appear here
              after review runs.
            </div>
          </div>
          <div className={styles.consistencyPanelHeader}>
            <button
              type='button'
              onClick={() => void handleRunConsistencyReview()}
              disabled={isRunningConsistencyReview}
            >
              {isRunningConsistencyReview ? 'Running project review...' : 'Run project review'}
            </button>
          </div>
          {lastConsistencyReviewAt && (
            <div className={styles.consistencyLastRun}>
              Last run: {new Date(lastConsistencyReviewAt).toLocaleString()}
            </div>
          )}
          {hiddenStateMutationReviewCount > 0 && (
            <div className={styles.consistencyDescription}>
              {hiddenStateMutationReviewCount} hidden suggested state change
              {hiddenStateMutationReviewCount === 1 ? '' : 's'} kept out of the active queue.
              {' '}
              <button
                type='button'
                onClick={restoreAllHiddenStateMutationReviewItems}
                className={styles.consistencyRelatedButton}
              >
                Restore all
              </button>
            </div>
          )}
          {consistencyReviewItems.length > 0 && (
            <>
              <div className={styles.consistencyDescription}>
                <strong>Review issues</strong>
              </div>
              <ul className={styles.consistencyList}>
                {consistencyReviewItems.slice(0, 24).map((item) => (
                  <li key={item.id} className={styles.consistencyListItem}>
                    <strong>{getIssueLabel(item.issue.code)}</strong>{' '}
                    <button
                      type='button'
                      onClick={() => {
                        const doc = documents.find((entry) => entry.id === item.sceneId);
                        if (doc) handleSelectDocument(doc);
                      }}
                      className={styles.consistencySceneButton}
                      title={`Open ${item.sceneTitle}`}
                    >
                      {item.sceneTitle}
                    </button>
                    : {item.issue.message}
                    {item.reviewAnnotation?.summary && (
                      <div className={styles.consistencyDescription}>
                        {item.reviewAnnotation.summary}
                      </div>
                    )}
                    {item.reviewAnnotation && (
                      <span className={styles.consistencyReason}>
                        {item.reviewAnnotation.engineLabel}
                      </span>
                    )}
                    {item.issue.detectionReason && (
                      <span
                        className={styles.consistencyReason}
                        title={getDetectionReason(item.issue.detectionReason).title}
                      >
                        {getDetectionReason(item.issue.detectionReason).label}
                      </span>
                    )}
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
            </>
          )}
          {stateMutationReviewItems.length > 0 && (
            <>
              <div className={styles.consistencyDescription}>
                <strong>Suggested state changes</strong>
              </div>
              {stateMutationReviewGroups.slice(0, 24).map((group) => {
                const batchAcceptId = `scene:${group.sceneId}:accept`;
                const batchRejectId = `scene:${group.sceneId}:reject`;
                const validCount = group.items.filter((item) => item.canAcceptInBatch).length;
                const hiddenCount =
                  hiddenStateMutationReviewCountBySceneId[group.sceneId] ?? 0;
                return (
                  <div key={group.sceneId}>
                    <div className={styles.consistencyPanelHeader}>
                      <button
                        type='button'
                        onClick={() => {
                          const doc = documents.find((entry) => entry.id === group.sceneId);
                          if (doc) handleSelectDocument(doc);
                        }}
                        className={styles.consistencySceneButton}
                        title={`Open ${group.sceneTitle}`}
                      >
                        {group.sceneTitle}
                      </button>
                      <button
                        type='button'
                        onClick={() => void acceptSceneStateMutationReviewItems(group.sceneId)}
                        disabled={validCount === 0 || applyingStateMutationReviewId === batchAcceptId}
                        className={styles.consistencyRelatedButton}
                      >
                        {applyingStateMutationReviewId === batchAcceptId ? 'Applying...' : `Accept valid (${validCount})`}
                      </button>
                      <button
                        type='button'
                        onClick={() => void rejectSceneStateMutationReviewItems(group.sceneId)}
                        disabled={applyingStateMutationReviewId === batchRejectId}
                        className={styles.consistencyRelatedButton}
                      >
                        {applyingStateMutationReviewId === batchRejectId ? 'Rejecting...' : 'Reject all'}
                      </button>
                      {hiddenCount > 0 ? (
                        <button
                          type='button'
                          onClick={() => restoreHiddenStateMutationReviewItems(group.sceneId)}
                          className={styles.consistencyRelatedButton}
                        >
                          {`Restore hidden (${hiddenCount})`}
                        </button>
                      ) : null}
                    </div>
                    <ul className={styles.consistencyList}>
                      {group.items.map((item) => (
                        <li key={item.id} className={styles.consistencyListItem}>
                          <strong>{item.actorLabel}</strong>
                          {item.sceneSequence ? ` · Step ${item.sceneSequence}` : ''}
                          <div className={styles.consistencyRelated}>
                            {item.canAccept ? (
                              <span className={styles.consistencyBadgeReady}>Ready</span>
                            ) : item.canAcceptInBatch ? (
                              <span className={styles.consistencyBadgeBatch}>After earlier steps</span>
                            ) : (
                              <span className={styles.consistencyBadgeBlocked}>Blocked</span>
                            )}
                          </div>
                          {item.summaryLines.map((line) => (
                            <div key={`${item.id}-${line}`} className={styles.consistencyDescription}>
                              {line}
                            </div>
                          ))}
                          {item.effectLines.map((line) => (
                            <div key={`${item.id}:effect:${line}`} className={styles.consistencyDescription}>
                              {line}
                            </div>
                          ))}
                          {item.acceptanceHint && (
                            <div className={styles.consistencyDescription}>
                              {item.acceptanceHint}
                            </div>
                          )}
                          {item.validationIssues.map((issue) => (
                            <div key={`${item.id}:issue:${issue}`} className={styles.consistencyDescription}>
                              {issue}
                            </div>
                          ))}
                          <div className={styles.consistencyRelated}>
                            <button
                              type='button'
                              onClick={() => void acceptStateMutationReviewItem(item.id)}
                              disabled={!item.canAccept || applyingStateMutationReviewId === item.id}
                              className={styles.consistencyRelatedButton}
                            >
                              {applyingStateMutationReviewId === item.id ? 'Applying...' : 'Accept'}
                            </button>
                            <button
                              type='button'
                              onClick={() => void rejectStateMutationReviewItem(item.id)}
                              disabled={applyingStateMutationReviewId === item.id}
                              className={styles.consistencyRelatedButton}
                            >
                              Reject
                            </button>
                            <button
                              type='button'
                              onClick={() => hideStateMutationReviewItem(item.id)}
                              disabled={applyingStateMutationReviewId === item.id}
                              className={styles.consistencyRelatedButton}
                            >
                              Hide for now
                            </button>
                          </div>
                          <span className={styles.consistencyReason}>Deterministic state review</span>
                          {item.staleLabel && (
                            <span className={styles.consistencyReason}>
                              {item.isStale ? `Stale: ${item.staleLabel}` : item.staleLabel}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
          {consistencyReviewItems.length === 0 && stateMutationReviewItems.length === 0 ? (
            <p className={styles.contextSummaryText}>No open review items.</p>
          ) : null}
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
    if (activeContextView === 'scratchpad') {
      return (
        <div className={styles.contextSummary}>
          <div className={styles.contextSummaryText}>
            <strong>Scratchpad</strong>
            <div className={styles.consistencyDescription}>
              Private project notes that stay out of scenes and canon.
            </div>
          </div>
          <textarea
            className={styles.scratchpadTextarea}
            value={scratchpadContent}
            onChange={(event) => setScratchpadContent(event.target.value)}
            placeholder='Loose notes, fragments, reminders, questions...'
            aria-label='Project scratchpad'
          />
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
              className={styles.contextTabButton}
              style={{
                backgroundColor:
                  tab.id === activeContextView ? '#dbeafe' : 'transparent'
              }}
            >
              <span>{tab.label}</span>
              {tab.id === 'review' && reviewReadiness.count > 0 && (
                <span className={styles.contextTabBadge}>
                  {reviewReadiness.count}
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
