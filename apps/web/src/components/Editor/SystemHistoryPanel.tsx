import {useMemo, useState} from 'react';
import type {SystemHistoryEntry} from '../../entityTypes';
import styles from '../../assets/components/AISettings.module.css';

interface SystemHistoryPanelProps {
  entries: SystemHistoryEntry[];
  onInsertEntry: (entry: SystemHistoryEntry) => void;
  onClear: () => void;
  onOpenScene?: (sceneId: string) => void;
  onRunConsistencyReview?: () => void;
}

const formatTimestamp = (value: number): string => new Date(value).toLocaleString();

type SystemFilter = 'all' | SystemHistoryEntry['category'];

const FILTERS: Array<{id: SystemFilter; label: string}> = [
  {id: 'all', label: 'All'},
  {id: 'quest', label: 'Quest'},
  {id: 'resource', label: 'Resource'},
  {id: 'consistency', label: 'Consistency'},
  {id: 'system', label: 'System'}
];

export const SystemHistoryPanel = ({
  entries,
  onInsertEntry,
  onClear,
  onOpenScene,
  onRunConsistencyReview
}: SystemHistoryPanelProps) => {
  const [filter, setFilter] = useState<SystemFilter>('all');

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => entry.category === filter);
  }, [entries, filter]);

  const criticalEntryId = useMemo(() => {
    const candidate = entries.find((entry) => {
      if (entry.category !== 'consistency') return false;
      const normalized = entry.message.toLowerCase();
      const hasIssueMarker =
        normalized.includes('found') && normalized.includes('issue');
      const cleanMarker = normalized.includes('no issues');
      return hasIssueMarker && !cleanMarker;
    });
    return candidate?.id ?? null;
  }, [entries]);

  return (
    <div className={styles.systemPanel}>
      <div className={styles.systemPanelHeader}>
        <h3 className={styles.systemPanelTitle}>System History</h3>
        <button type='button' onClick={onClear} disabled={entries.length === 0}>
          Clear
        </button>
      </div>
      <div className={styles.systemFilters}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type='button'
            className={`${styles.systemFilterButton} ${
              filter === item.id ? styles.systemFilterButtonActive : ''
            }`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {filteredEntries.length === 0 ? (
        <p className={styles.systemEmpty}>
          {entries.length === 0
            ? 'No system events yet. Actions like scene creation, review, and exports will appear here.'
            : 'No events match the current filter.'}
        </p>
      ) : (
        <ul className={styles.systemList}>
          {filteredEntries.slice(0, 80).map((entry) => (
            <li
              key={entry.id}
              className={`${styles.systemListItem} ${
                entry.id === criticalEntryId ? styles.systemListItemCritical : ''
              }`}
            >
              <div className={styles.systemMeta}>
                <span>{entry.category}</span>
                <span>{formatTimestamp(entry.createdAt)}</span>
              </div>
              <p className={styles.systemMessage}>{entry.message}</p>
              <div className={styles.systemActions}>
                <button type='button' onClick={() => onInsertEntry(entry)}>
                  Insert into scene
                </button>
                {entry.id === criticalEntryId && entry.sceneId && onOpenScene && (
                  <button
                    type='button'
                    onClick={() => {
                      if (!entry.sceneId) return;
                      onOpenScene(entry.sceneId);
                    }}
                  >
                    Open scene
                  </button>
                )}
                {entry.id === criticalEntryId && onRunConsistencyReview && (
                  <button type='button' onClick={onRunConsistencyReview}>
                    Run review now
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
