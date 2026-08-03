import styles from '../../assets/components/CompendiumRoute.module.css';
import type {
  CompendiumActionLog,
  CompendiumEntry,
  CompendiumProgress
} from '../../entityTypes';
import {
  COMPENDIUM_TABS,
  type CompendiumNextStepItem,
  type CompendiumTab
} from './constants';

interface OverviewTabProps {
  entryById: Map<string, CompendiumEntry>;
  isLoading: boolean;
  logs: CompendiumActionLog[];
  nextStepItems: CompendiumNextStepItem[];
  openTabWithSmartDefaults: (tab: CompendiumTab, stepId?: string) => void;
  progress: CompendiumProgress | null;
}

export function OverviewTab({
  entryById,
  isLoading,
  logs,
  nextStepItems,
  openTabWithSmartDefaults,
  progress
}: OverviewTabProps) {
  return (
    <>
      <p className={`${styles.marginTop0} ${styles.marginBottom09rem} ${styles.colorVarColorTextSecondary}`}>
        Use this snapshot to see progress at a glance, then jump into the next
        task without scanning every advanced system.
      </p>
      <div
        className={`${styles.displayGrid} ${styles.gridTemplateColumnsRepeatAutoFitMinmax220px1fr} ${styles.gap075rem} ${styles.marginBottom1rem}`}
      >
        <article className={`${styles.padding085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h3 className={`${styles.marginTop0} ${styles.marginBottom045rem}`}>Total Points</h3>
          <div className={`${styles.fontSize11rem} ${styles.fontWeight700}`}>
            {isLoading || !progress ? '...' : progress.totalPoints}
          </div>
        </article>
        <article className={`${styles.padding085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h3 className={`${styles.marginTop0} ${styles.marginBottom045rem}`}>Milestones Unlocked</h3>
          <div className={`${styles.fontSize11rem} ${styles.fontWeight700}`}>
            {isLoading || !progress ? '...' : progress.unlockedMilestoneIds.length}
          </div>
        </article>
        <article className={`${styles.padding085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h3 className={`${styles.marginTop0} ${styles.marginBottom045rem}`}>Recipes Unlocked</h3>
          <div className={`${styles.fontSize11rem} ${styles.fontWeight700}`}>
            {isLoading || !progress ? '...' : progress.unlockedRecipeIds.length}
          </div>
        </article>
      </div>

      <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.marginBottom1rem}`}>
        <h2 className={styles.marginTop0}>What To Do Next</h2>
        <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
          {nextStepItems.map((step) => (
            <li key={step.id} className={styles.marginBottom045rem}>
              {step.done ? 'Done' : 'Next'}: {step.label}{' '}
              {!step.done && (
                <button
                  type='button'
                  onClick={() => openTabWithSmartDefaults(step.tab, step.id)}
                >
                  Open {COMPENDIUM_TABS.find((tab) => tab.id === step.tab)?.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
        <h2 className={styles.marginTop0}>Recent Actions</h2>
        {logs.length === 0 ? (
          <>
            <p className={styles.marginBottom065rem}>No actions logged yet.</p>
            <button
              type='button'
              onClick={() => openTabWithSmartDefaults('entries', 'log-action')}
            >
              Go to Entries to log your first action
            </button>
          </>
        ) : (
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
            {logs.slice(0, 12).map((log) => (
              <li key={log.id} className={styles.marginBottom035rem}>
                {(() => {
                  const entry = entryById.get(log.entryId);
                  const actionLabel =
                    entry?.actions.find((action) => action.id === log.actionId)
                      ?.label ?? log.actionId;
                  const entryLabel = entry?.name ?? log.entryId;
                  return (
                    <>
                      +{log.pointsAwarded} pts · {entryLabel} · {actionLabel} ·{' '}
                      {new Date(log.createdAt).toLocaleString()}
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
