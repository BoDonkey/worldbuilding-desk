import type {RefObject} from 'react';
import type {useWorkspaceCorkboard} from '../../hooks/useWorkspaceCorkboard';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceCorkboardModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  corkboard: ReturnType<typeof useWorkspaceCorkboard>;
  onClose: () => void;
  onOpenScratchpad: () => void;
}

export const WorkspaceCorkboardModal = ({
  isOpen, dialogRef, corkboard, onClose, onOpenScratchpad
}: WorkspaceCorkboardModalProps) => {
  if (!isOpen) return null;
  const {
    corkboardCards: cards, corkboardStatus: status,
    corkboardLastSavedAt: lastSavedAt, corkboardPlotPointCount,
    createCorkboardCard, updateCorkboardCard, deleteCorkboardCard,
    moveCorkboardCard, addCorkboardPlotPoint, updateCorkboardPlotPoint,
    deleteCorkboardPlotPoint, moveCorkboardPlotPoint
  } = corkboard;
  const statusLabel = status === 'loading'
    ? 'Loading corkboard...'
    : status === 'saving'
      ? 'Saving corkboard...'
      : status === 'error'
        ? 'Corkboard could not be saved.'
        : lastSavedAt
          ? `Corkboard saved at ${new Date(lastSavedAt).toLocaleTimeString()}`
          : 'Corkboard ready.';

  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' aria-label='Project corkboard'
      onClick={onClose} className={styles.modalOverlay}>
      <div onClick={(event) => event.stopPropagation()}
        className={`${styles.modalCard} ${styles.corkboardModalCard}`}>
        <div className={styles.corkboardModalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Corkboard</h3>
            <p className={styles.modalDescription}>
              Lightweight chapter planning with cards, summaries, status, and plot points.
            </p>
          </div>
          <div className={styles.corkboardHeaderActions}>
            <button type='button' className={styles.modalSecondaryAction}
              onClick={createCorkboardCard}>New Card</button>
            <button type='button' className={styles.modalSecondaryAction}
              onClick={onClose}>Close</button>
          </div>
        </div>
        <div className={styles.corkboardMetaRow}>
          <span>{cards.length} card{cards.length === 1 ? '' : 's'}</span>
          <span>{corkboardPlotPointCount} plot point{corkboardPlotPointCount === 1 ? '' : 's'}</span>
          <span>{statusLabel}</span>
        </div>
        {cards.length === 0 ? (
          <div className={styles.corkboardEmptyState}>
            <p className={styles.corkboardEmptyTitle}>Start with a chapter card.</p>
            <p className={styles.corkboardEmptyCopy}>
              Sketch scenes, chapter beats, or loose sequence ideas without leaving the writing workspace.
            </p>
            <button type='button' onClick={createCorkboardCard}>Create first card</button>
          </div>
        ) : (
          <div className={styles.corkboardCardList}>
            {cards.map((card, index) => (
              <section key={card.id} className={styles.corkboardCard}>
                <div className={styles.corkboardCardHeader}>
                  <div className={styles.corkboardCardTitleRow}>
                    <span className={styles.corkboardCardIndex}>Card {index + 1}</span>
                    <input type='text' value={card.title}
                      onChange={(event) => updateCorkboardCard(card.id, {title: event.target.value})}
                      placeholder='Chapter or sequence title' className={styles.corkboardTitleInput} />
                  </div>
                  <div className={styles.corkboardCardActions}>
                    <button type='button' className={styles.modalSecondaryAction}
                      onClick={() => moveCorkboardCard(card.id, -1)} disabled={index === 0}>Up</button>
                    <button type='button' className={styles.modalSecondaryAction}
                      onClick={() => moveCorkboardCard(card.id, 1)} disabled={index === cards.length - 1}>Down</button>
                    <button type='button' className={styles.modalSecondaryAction}
                      onClick={() => deleteCorkboardCard(card.id)}>Delete</button>
                  </div>
                </div>
                <div className={styles.corkboardCardFields}>
                  <label className={styles.corkboardField}>
                    <span>Status</span>
                    <select value={card.status} onChange={(event) => updateCorkboardCard(card.id, {
                      status: event.target.value as 'planned' | 'draft' | 'written'
                    })}>
                      <option value='planned'>Planned</option>
                      <option value='draft'>Draft</option>
                      <option value='written'>Written</option>
                    </select>
                  </label>
                  <label className={styles.corkboardField}>
                    <span>Summary</span>
                    <textarea value={card.summary}
                      onChange={(event) => updateCorkboardCard(card.id, {summary: event.target.value})}
                      placeholder='What happens in this chapter or scene sequence?'
                      className={styles.corkboardSummaryTextarea} />
                  </label>
                </div>
                <div className={styles.corkboardPlotSection}>
                  <div className={styles.corkboardPlotHeader}>
                    <strong>Plot points</strong>
                    <button type='button' className={styles.modalSecondaryAction}
                      onClick={() => addCorkboardPlotPoint(card.id)}>Add plot point</button>
                  </div>
                  {card.plotPoints.length === 0 ? (
                    <p className={styles.corkboardPlotEmpty}>No plot points yet.</p>
                  ) : (
                    <div className={styles.corkboardPlotList}>
                      {card.plotPoints.map((plotPoint, plotIndex) => (
                        <div key={plotPoint.id} className={styles.corkboardPlotPoint}>
                          <div className={styles.corkboardPlotPointHeader}>
                            <span className={styles.corkboardPlotIndex}>{plotIndex + 1}</span>
                            <input type='text' value={plotPoint.title}
                              onChange={(event) => updateCorkboardPlotPoint(card.id, plotPoint.id, {title: event.target.value})}
                              placeholder='Beat or turning point' className={styles.corkboardPlotTitleInput} />
                            <div className={styles.corkboardPlotActions}>
                              <button type='button' className={styles.modalSecondaryAction}
                                onClick={() => moveCorkboardPlotPoint(card.id, plotPoint.id, -1)}
                                disabled={plotIndex === 0}>Up</button>
                              <button type='button' className={styles.modalSecondaryAction}
                                onClick={() => moveCorkboardPlotPoint(card.id, plotPoint.id, 1)}
                                disabled={plotIndex === card.plotPoints.length - 1}>Down</button>
                              <button type='button' className={styles.modalSecondaryAction}
                                onClick={() => deleteCorkboardPlotPoint(card.id, plotPoint.id)}>Delete</button>
                            </div>
                          </div>
                          <textarea value={plotPoint.notes ?? ''}
                            onChange={(event) => updateCorkboardPlotPoint(card.id, plotPoint.id, {notes: event.target.value})}
                            placeholder='Optional note or reminder' className={styles.corkboardPlotNotes} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
        <div className={styles.corkboardFooterActions}>
          <button type='button' className={styles.modalSecondaryAction}
            onClick={onOpenScratchpad}>Open Scratchpad</button>
          <button type='button' onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
