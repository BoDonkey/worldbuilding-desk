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
      <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
        Use this snapshot to see progress at a glance, then jump into the next
        task without scanning every advanced system.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Total Points</h3>
          <div style={{fontSize: '1.1rem', fontWeight: 700}}>
            {isLoading || !progress ? '...' : progress.totalPoints}
          </div>
        </article>
        <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Milestones Unlocked</h3>
          <div style={{fontSize: '1.1rem', fontWeight: 700}}>
            {isLoading || !progress ? '...' : progress.unlockedMilestoneIds.length}
          </div>
        </article>
        <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Recipes Unlocked</h3>
          <div style={{fontSize: '1.1rem', fontWeight: 700}}>
            {isLoading || !progress ? '...' : progress.unlockedRecipeIds.length}
          </div>
        </article>
      </div>

      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '1rem'}}>
        <h2 style={{marginTop: 0}}>What To Do Next</h2>
        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
          {nextStepItems.map((step) => (
            <li key={step.id} style={{marginBottom: '0.45rem'}}>
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

      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Recent Actions</h2>
        {logs.length === 0 ? (
          <>
            <p style={{marginBottom: '0.65rem'}}>No actions logged yet.</p>
            <button
              type='button'
              onClick={() => openTabWithSmartDefaults('entries', 'log-action')}
            >
              Go to Entries to log your first action
            </button>
          </>
        ) : (
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {logs.slice(0, 12).map((log) => (
              <li key={log.id} style={{marginBottom: '0.35rem'}}>
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
