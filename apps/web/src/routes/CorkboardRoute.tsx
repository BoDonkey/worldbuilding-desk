import {useEffect, useMemo, useState} from 'react';
import type {FormEvent} from 'react';
import {useNavigate} from 'react-router';
import type {ChapterCardStatus, PlotPoint} from '../entityTypes';
import {useAppStore} from '../store/appStore';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';
import {PageHeader} from '../components/PageHeader';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useStoryDashboardData} from '../hooks/useStoryDashboardData';
import {StoryDashboard} from '../components/Corkboard/StoryDashboard';
import styles from '../styles/CorkboardRoute.module.css';

const STATUS_LABELS: Record<ChapterCardStatus, string> = {
  planned: 'Planned',
  draft: 'Draft',
  written: 'Written'
};

const summarize = (value: string, limit = 140): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trim()}...`;
};

const getChapterRailStorageKey = (projectId: string) =>
  `wbd:corkboard:chapter-rail-collapsed:${projectId}`;

function CorkboardRoute() {
  const navigate = useNavigate();
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const {
    corkboardCards,
    corkboardStatus,
    corkboardLastSavedAt,
    corkboardPlotPointCount,
    createCorkboardCard,
    updateCorkboardCard,
    deleteCorkboardCard,
    moveCorkboardCard,
    addCorkboardPlotPoint,
    updateCorkboardPlotPoint,
    deleteCorkboardPlotPoint,
    moveCorkboardPlotPoint
  } = useWorkspaceCorkboard(activeProject?.id ?? null);
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [beatTitle, setBeatTitle] = useState('');
  const [beatNotes, setBeatNotes] = useState('');
  const [isChapterRailCollapsed, setIsChapterRailCollapsed] = useState(false);
  const [view, setView] = useState<'planning' | 'dashboard'>('planning');
  const {dashboard, documents, status: dashboardStatus} = useStoryDashboardData({
    projectId: activeProject?.id ?? null,
    cards: corkboardCards,
    mechanicsEnabled: Boolean(projectSettings && projectSettings.projectMode !== 'general')
  });

  useEffect(() => {
    if (!activeProject) {
      setIsChapterRailCollapsed(false);
      return;
    }
    setIsChapterRailCollapsed(
      window.localStorage.getItem(getChapterRailStorageKey(activeProject.id)) === 'true'
    );
  }, [activeProject]);

  useEffect(() => {
    if (corkboardCards.length === 0) {
      setSelectedCardId(null);
      return;
    }
    setSelectedCardId((current) =>
      current && corkboardCards.some((card) => card.id === current)
        ? current
        : corkboardCards[0].id
    );
  }, [corkboardCards]);

  const selectedCard = useMemo(
    () => corkboardCards.find((card) => card.id === selectedCardId) ?? null,
    [corkboardCards, selectedCardId]
  );

  const statusLabel =
    corkboardStatus === 'loading'
      ? 'Loading corkboard...'
      : corkboardStatus === 'saving'
        ? 'Saving corkboard...'
        : corkboardStatus === 'error'
          ? 'Corkboard could not be saved.'
          : corkboardLastSavedAt
            ? `Corkboard saved at ${new Date(corkboardLastSavedAt).toLocaleTimeString()}`
            : 'Corkboard ready.';
  const isCorkboardLoading = corkboardStatus === 'loading';

  const handleCreateCard = () => {
    createCorkboardCard();
  };

  const handleDeleteCard = (cardId: string, cardTitle: string) => {
    requestConfirm({
      title: `Delete "${cardTitle || 'this chapter card'}"?`,
      message: 'This chapter card and its plot points will be permanently removed.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => deleteCorkboardCard(cardId)
    });
  };

  const handleDeleteBeat = (cardId: string, pointId: string, pointTitle: string) => {
    requestConfirm({
      title: `Delete "${pointTitle || 'this plot point'}"?`,
      message: 'This plot point will be permanently removed.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => deleteCorkboardPlotPoint(cardId, pointId)
    });
  };

  const handleToggleChapterRail = () => {
    setIsChapterRailCollapsed((current) => {
      const next = !current;
      if (activeProject) {
        window.localStorage.setItem(getChapterRailStorageKey(activeProject.id), String(next));
      }
      return next;
    });
  };

  const handleSelectCard = (cardId: string) => {
    setSelectedCardId(cardId);
    setEditingBeatId(null);
    setBeatTitle('');
    setBeatNotes('');
  };

  const handleEditBeat = (plotPoint: PlotPoint) => {
    setEditingBeatId(plotPoint.id);
    setBeatTitle(plotPoint.title);
    setBeatNotes(plotPoint.notes ?? '');
  };

  const resetBeatForm = () => {
    setEditingBeatId(null);
    setBeatTitle('');
    setBeatNotes('');
  };

  const handleSaveBeat = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCard || !beatTitle.trim()) {
      return;
    }
    if (editingBeatId) {
      updateCorkboardPlotPoint(selectedCard.id, editingBeatId, {
        title: beatTitle.trim(),
        notes: beatNotes.trim()
      });
    } else {
      addCorkboardPlotPoint(selectedCard.id, {
        title: beatTitle.trim(),
        notes: beatNotes.trim()
      });
    }
    resetBeatForm();
  };

  const handleToggleSceneLink = (sceneId: string) => {
    if (!selectedCard) return;
    const current = selectedCard.sceneIds ?? [];
    updateCorkboardCard(selectedCard.id, {
      sceneIds: current.includes(sceneId)
        ? current.filter((id) => id !== sceneId)
        : [...current, sceneId]
    });
  };

  const handleOpenScene = (sceneId: string) => {
    navigate('/workspace', {state: {focusDocumentId: sceneId}});
  };

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow='Planning'
          title='Corkboard'
          description='Open or create a project first to plan story arcs and chapter beats.'
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Planning'
        title='Corkboard'
        description='Plan story arcs, chapters, and turning points without changing the writing workspace. The quick workspace modal uses these same cards.'
        actions={<ProjectScratchpadButton projectId={activeProject.id} />}
      />

      <div className={styles.utilityRow}>
        <div className={styles.viewSwitch} aria-label='Corkboard view'>
          <button
            type='button'
            className={view === 'planning' ? styles.viewSwitchActive : ''}
            aria-pressed={view === 'planning'}
            onClick={() => setView('planning')}
          >
            Planning
          </button>
          <button
            type='button'
            className={view === 'dashboard' ? styles.viewSwitchActive : ''}
            aria-pressed={view === 'dashboard'}
            onClick={() => setView('dashboard')}
          >
            Story Dashboard
          </button>
        </div>
        <div className={styles.utilityActions}>
          {view === 'planning' && corkboardCards.length > 0 && (
            <button
              type='button'
              onClick={handleToggleChapterRail}
            >
              {isChapterRailCollapsed ? 'Show Chapter Cards' : 'Hide Chapter Cards'}
            </button>
          )}
          {view === 'planning' && (
            <button type='button' onClick={handleCreateCard} disabled={isCorkboardLoading}>
              New Chapter Card
            </button>
          )}
        </div>
      </div>

      <div className={styles.metaRow}>
        {view === 'planning' ? (
          <>
            <span className={styles.countChip}>{corkboardCards.length} card{corkboardCards.length === 1 ? '' : 's'}</span>
            <span className={styles.countChip}>{corkboardPlotPointCount} beat{corkboardPlotPointCount === 1 ? '' : 's'}</span>
            <span className={styles.status} role='status'>{statusLabel}</span>
          </>
        ) : (
          <span className={styles.status} role='status'>Dashboard uses saved project data and does not edit it.</span>
        )}
      </div>

      {view === 'dashboard' ? (
        <StoryDashboard
          dashboard={dashboard}
          status={dashboardStatus}
          onOpenScene={handleOpenScene}
          projectId={activeProject.id}
          aiConfig={projectSettings?.aiSettings}
        />
      ) : corkboardCards.length === 0 ? (
        <div className={styles.panel}>
          <p className={styles.emptyState}>
            Start with a chapter card. You can add beats after the first card exists.
          </p>
          <button
            type='button'
            onClick={handleCreateCard}
            disabled={isCorkboardLoading}
            className={styles.createFirstButton}
          >
            Create first card
          </button>
        </div>
      ) : (
        <div
          className={`${styles.layout} ${
            isChapterRailCollapsed ? styles.layoutRailCollapsed : ''
          }`}
        >
          {!isChapterRailCollapsed && (
            <aside className={`${styles.panel} ${styles.listPanel}`} aria-label='Chapter cards'>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Chapters</h2>
                <span className={styles.countChip}>{corkboardCards.length}</span>
              </div>
              <ul className={styles.chapterList}>
                {corkboardCards.map((card, index) => (
                  <li key={card.id}>
                    <button
                      type='button'
                      className={`${styles.chapterButton} ${
                        card.id === selectedCard?.id ? styles.chapterButtonActive : ''
                      }`}
                      onClick={() => handleSelectCard(card.id)}
                    >
                      <div className={styles.chapterButtonTop}>
                        <span className={styles.orderChip}>Ch {index + 1}</span>
                        <span className={styles.status}>{STATUS_LABELS[card.status]}</span>
                      </div>
                      <span className={styles.chapterTitle}>
                        {card.title.trim() || 'Untitled chapter'}
                      </span>
                      {card.summary.trim() && (
                        <span className={styles.chapterSummary}>{summarize(card.summary)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {selectedCard && (
            <div className={`${styles.panel} ${styles.editorPanel}`}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Chapter Card</h2>
                <div className={styles.cardActions}>
                  <button
                    type='button'
                    onClick={() => moveCorkboardCard(selectedCard.id, -1)}
                    disabled={corkboardCards[0]?.id === selectedCard.id}
                  >
                    Move Up
                  </button>
                  <button
                    type='button'
                    onClick={() => moveCorkboardCard(selectedCard.id, 1)}
                    disabled={corkboardCards.at(-1)?.id === selectedCard.id}
                  >
                    Move Down
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDeleteCard(selectedCard.id, selectedCard.title)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  Title
                  <input
                    type='text'
                    value={selectedCard.title}
                    onChange={(event) =>
                      updateCorkboardCard(selectedCard.id, {title: event.target.value})
                    }
                    placeholder='Chapter or sequence title'
                  />
                </label>
                <label className={styles.field}>
                  Status
                  <select
                    value={selectedCard.status}
                    onChange={(event) =>
                      updateCorkboardCard(selectedCard.id, {
                        status: event.target.value as ChapterCardStatus
                      })
                    }
                  >
                    <option value='planned'>Planned</option>
                    <option value='draft'>Draft</option>
                    <option value='written'>Written</option>
                  </select>
                </label>
              </div>

              <label className={styles.field}>
                Summary
                <textarea
                  value={selectedCard.summary}
                  onChange={(event) =>
                    updateCorkboardCard(selectedCard.id, {summary: event.target.value})
                  }
                  placeholder='What changes in this chapter? What pressure does it add to the arc?'
                />
              </label>

              <section className={styles.sceneLinkEditor}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Draft scenes</h2>
                    <p className={styles.inputNote}>Explicit links power chapter rollups. Nothing is matched by title or order.</p>
                  </div>
                  <span className={styles.countChip}>{selectedCard.sceneIds?.length ?? 0} linked</span>
                </div>
                {documents.length === 0 ? (
                  <p className={styles.emptyState}>No saved scenes are available to link.</p>
                ) : (
                  <div className={styles.sceneChecklist}>
                    {documents.map((document) => (
                      <label key={document.id} className={styles.sceneCheck}>
                        <input
                          type='checkbox'
                          checked={selectedCard.sceneIds?.includes(document.id) ?? false}
                          onChange={() => handleToggleSceneLink(document.id)}
                        />
                        <span>{document.title.trim() || 'Untitled scene'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.beatSection}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Beats</h2>
                  <span className={styles.countChip}>{selectedCard.plotPoints.length}</span>
                </div>
                <form className={styles.beatEditor} onSubmit={handleSaveBeat}>
                  <label className={styles.field}>
                    Beat title
                    <input
                      type='text'
                      value={beatTitle}
                      onChange={(event) => setBeatTitle(event.target.value)}
                      placeholder='Turning point, reveal, reversal...'
                    />
                  </label>
                  <label className={styles.field}>
                    Notes
                    <textarea
                      value={beatNotes}
                      onChange={(event) => setBeatNotes(event.target.value)}
                      placeholder='What happens, why it matters, or what to remember while drafting.'
                    />
                  </label>
                  <div className={styles.actionRow}>
                    <button type='submit' disabled={!beatTitle.trim()}>
                      {editingBeatId ? 'Save Beat' : 'Add Beat'}
                    </button>
                    {editingBeatId && (
                      <button type='button' onClick={resetBeatForm}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {selectedCard.plotPoints.length === 0 ? (
                  <p className={styles.emptyState}>No beats yet.</p>
                ) : (
                  <ul className={styles.beatList}>
                    {selectedCard.plotPoints.map((point, index) => (
                      <li key={point.id} className={styles.beatItem}>
                        <div className={styles.beatTop}>
                          <div>
                            <span className={styles.orderChip}>Beat {index + 1}</span>
                            <div className={styles.beatTitle}>{point.title || 'Untitled beat'}</div>
                            {point.notes && <div className={styles.beatNotes}>{point.notes}</div>}
                          </div>
                          <div className={styles.beatActions}>
                            <button
                              type='button'
                              onClick={() => moveCorkboardPlotPoint(selectedCard.id, point.id, -1)}
                              disabled={index === 0}
                            >
                              Up
                            </button>
                            <button
                              type='button'
                              onClick={() => moveCorkboardPlotPoint(selectedCard.id, point.id, 1)}
                              disabled={index === selectedCard.plotPoints.length - 1}
                            >
                              Down
                            </button>
                            <button type='button' onClick={() => handleEditBeat(point)}>
                              Edit
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                handleDeleteBeat(selectedCard.id, point.id, point.title)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {confirmDialog}
    </section>
  );
}

export default CorkboardRoute;
