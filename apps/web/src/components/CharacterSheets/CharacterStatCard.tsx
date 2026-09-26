import type {ReactNode} from 'react';
import type {
  CharacterSnapshot,
  CharacterSnapshotInventoryLine,
  CharacterSnapshotResourceLine,
  CharacterSnapshotStatLine
} from '../../services/state/characterSnapshot';
import {
  applyCharacterStatCardTemplate,
  type CharacterStatCardTemplate
} from '../../services/state/characterPeek';
import styles from '../../styles/CharacterStatCard.module.css';

export function CharacterResourceMeters({
  resources
}: {
  resources: CharacterSnapshotResourceLine[];
}) {
  if (resources.length === 0) return null;
  return (
    <div className={styles.resources}>
      {resources.map((resource) => {
        const percent =
          typeof resource.max === 'number' && resource.max > 0
            ? Math.max(0, Math.min(100, (resource.current / resource.max) * 100))
            : 0;
        return (
          <div key={resource.id} className={styles.resource}>
            <div>
              <span>{resource.label}</span>
              <strong>
                {resource.current}
                {typeof resource.max === 'number' ? ` / ${resource.max}` : ''}
              </strong>
            </div>
            {typeof resource.max === 'number' && resource.max > 0 && (
              <div className={styles.meter}>
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
    <div className={styles.chips}>
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
    <details className={styles.details} open={open}>
      <summary>{summary}</summary>
      {location && (
        <div className={styles.location}>
          Location <strong>{location}</strong>
        </div>
      )}
      <div className={styles.statGrid}>
        {stats.map((stat) => (
          <div key={stat.id}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.inventory}>
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
 * keeps full state collapsed; `full` opens it. A stat-block `template` scopes
 * stats and resources like the project's inserted status windows, captions the
 * card to match, and sets the default density from its style.
 */
export function CharacterStatCard({
  snapshot,
  asOfLabel,
  density,
  template,
  actions
}: {
  snapshot: CharacterSnapshot;
  /** Where the state was read, e.g. "at the cursor in The Vault". */
  asOfLabel: string;
  density?: 'compact' | 'full';
  template?: CharacterStatCardTemplate;
  actions?: ReactNode;
}) {
  const shown = applyCharacterStatCardTemplate(snapshot, template);
  const effectiveDensity =
    density ?? (template && template.style !== 'compact' ? 'full' : 'compact');
  return (
    <article
      className={`${styles.card} ${template ? styles.statusWindow : ''}`}
      aria-label={`${snapshot.name} stats`}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <strong>{snapshot.name}</strong>
          <span>Level {snapshot.level}</span>
        </div>
      </div>
      {template && <div className={styles.statusWindowCaption}>[{template.label}]</div>}
      <div className={styles.source}>{asOfLabel}</div>
      <CharacterResourceMeters resources={shown.resources} />
      <CharacterStatusChips statuses={shown.statuses} />
      <CharacterStateDetails
        summary='Stats and inventory'
        location={shown.location}
        stats={shown.stats}
        inventory={shown.inventory}
        open={effectiveDensity === 'full'}
      />
      {actions}
    </article>
  );
}
