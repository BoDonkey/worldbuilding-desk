import type {ReactNode} from 'react';
import type {
  CharacterSnapshot,
  CharacterSnapshotInventoryLine,
  CharacterSnapshotResourceLine,
  CharacterSnapshotStatLine
} from '../../services/state/characterSnapshot';
// Shares the scene roster's styles so the roster renders unchanged; the card
// gets its own module when it appears outside Workspace (Slice 4.48).
import styles from '../../styles/WorkspaceRoute.module.css';

export function CharacterResourceMeters({
  resources
}: {
  resources: CharacterSnapshotResourceLine[];
}) {
  if (resources.length === 0) return null;
  return (
    <div className={styles.sceneRosterResources}>
      {resources.map((resource) => {
        const percent =
          typeof resource.max === 'number' && resource.max > 0
            ? Math.max(0, Math.min(100, (resource.current / resource.max) * 100))
            : 0;
        return (
          <div key={resource.id} className={styles.sceneRosterResource}>
            <div>
              <span>{resource.label}</span>
              <strong>
                {resource.current}
                {typeof resource.max === 'number' ? ` / ${resource.max}` : ''}
              </strong>
            </div>
            {typeof resource.max === 'number' && resource.max > 0 && (
              <div className={styles.sceneRosterMeter}>
                <span style={{width: `${percent}%`}} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CharacterStatusChips({statuses}: {statuses: string[]}) {
  if (statuses.length === 0) return null;
  return (
    <div className={styles.sceneRosterChips}>
      {statuses.map((status) => (
        <span key={status}>{status}</span>
      ))}
    </div>
  );
}

export function CharacterStateDetails({
  summary,
  location,
  stats,
  inventory,
  open,
  renderItemAction
}: {
  summary: string;
  location?: string;
  stats: CharacterSnapshotStatLine[];
  inventory: CharacterSnapshotInventoryLine[];
  open?: boolean;
  renderItemAction?: (item: CharacterSnapshotInventoryLine) => ReactNode;
}) {
  return (
    <details className={styles.sceneRosterDetails} open={open}>
      <summary>{summary}</summary>
      {location && (
        <div className={styles.sceneRosterLocation}>
          Location <strong>{location}</strong>
        </div>
      )}
      <div className={styles.sceneRosterStatGrid}>
        {stats.map((stat) => (
          <div key={stat.id}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.sceneRosterInventory}>
        <strong>Inventory</strong>
        {inventory.length > 0 ? (
          <ul>
            {inventory.map((item) => (
              <li key={item.name}>
                <span>
                  {item.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  {item.equipped ? ' · equipped' : ''}
                </span>
                {renderItemAction?.(item)}
              </li>
            ))}
          </ul>
        ) : (
          <span>None</span>
        )}
      </div>
    </details>
  );
}

/**
 * Read-only stat block for one character at a point in the manuscript. `compact`
 * keeps full state collapsed; `full` opens it.
 */
export function CharacterStatCard({
  snapshot,
  asOfLabel,
  density = 'compact',
  actions
}: {
  snapshot: CharacterSnapshot;
  /** Where the state was read, e.g. "at the cursor in The Vault". */
  asOfLabel: string;
  density?: 'compact' | 'full';
  actions?: ReactNode;
}) {
  return (
    <article className={styles.sceneRosterCard} aria-label={`${snapshot.name} stats`}>
      <div className={styles.sceneRosterCardHeader}>
        <div className={styles.sceneRosterIdentity}>
          <strong>{snapshot.name}</strong>
          <span>Level {snapshot.level}</span>
        </div>
      </div>
      <div className={styles.sceneRosterSource}>{asOfLabel}</div>
      <CharacterResourceMeters resources={snapshot.resources} />
      <CharacterStatusChips statuses={snapshot.statuses} />
      <CharacterStateDetails
        summary='Stats and inventory'
        location={snapshot.location}
        stats={snapshot.stats}
        inventory={snapshot.inventory}
        open={density === 'full'}
      />
      {actions}
    </article>
  );
}
