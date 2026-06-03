import {useEffect, useMemo, useState} from 'react';
import type {FormEvent} from 'react';
import type {ChapterCardStatus, PlotPoint} from '../entityTypes';
import {useAppStore} from '../store/appStore';
import {useWorkspaceCorkboard} from '../hooks/useWorkspaceCorkboard';
import {PageHeader} from '../components/PageHeader';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
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

function CorkboardRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [beatTitle, setBeatTitle] = useState('');
  const [beatNotes, setBeatNotes] = useState('');

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
        <span className={styles.status} role='status'>{statusLabel}</span>
        <button type='button' onClick={handleCreateCard} disabled={isCorkboardLoading}>
          New Chapter Card
        </button>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.countChip}>
          {corkboardCards.length} card{corkboardCards.length === 1 ? '' : 's'}
        </span>
        <span className={styles.countChip}>
          {corkboardPlotPointCount} beat{corkboardPlotPointCount === 1 ? '' : 's'}
        </span>
      </div>

      {corkboardCards.length === 0 ? (
        <div className={styles.panel}>
          <p className={styles.emptyState}>
            Start with a chapter card. You can add beats after the first card exists.
          </p>
          <button
            type='button'
            onClick={handleCreateCard}
            disabled={isCorkboardLoading}
            style={{marginTop: '0.75rem'}}
          >
            Create first card
          </button>
        </div>
      ) : (
        <div className={styles.layout}>
          <aside className={`${styles.panel} ${styles.listPanel}`}>
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
                  <button type='button' onClick={() => deleteCorkboardCard(selectedCard.id)}>
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
                              onClick={() => deleteCorkboardPlotPoint(selectedCard.id, point.id)}
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
    </section>
  );
}

export default CorkboardRoute;
