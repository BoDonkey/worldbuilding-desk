import React, {useEffect, useMemo, useState} from 'react';
import type {MemoryEntry} from '../services/shodh/ShodhMemoryService';
import styles from './ShodhMemoryPanel.module.css';

interface ScopeSelectorProps {
  label?: string;
  value: string;
  options: Array<{label: string; value: string}>;
  onChange: (value: string) => void;
}

interface ShodhMemoryPanelProps {
  title?: string;
  memories: MemoryEntry[];
  filterValue: string;
  onFilterChange: (value: string) => void;
  scopeSelector?: ScopeSelectorProps;
  scopeSummaryLabel?: string;
  highlightDocumentId?: string | null;
  onRefresh?: () => void;
  pageSize?: number;
  showDelete?: boolean;
  onDeleteMemory?: (id: string) => void;
  emptyState?: string;
  renderSourceLabel?: (memory: MemoryEntry) => React.ReactNode;
  renderMemoryActions?: (memory: MemoryEntry) => React.ReactNode;
}

export const ShodhMemoryPanel: React.FC<ShodhMemoryPanelProps> = ({
  title = 'Canon memories',
  memories,
  filterValue,
  onFilterChange,
  scopeSelector,
  scopeSummaryLabel,
  highlightDocumentId,
  onRefresh,
  pageSize = 5,
  showDelete = false,
  onDeleteMemory,
  emptyState = 'No memories captured yet.',
  renderSourceLabel,
  renderMemoryActions
}) => {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [filterValue, memories.length, pageSize, scopeSelector?.value]);

  const filteredMemories = useMemo(() => {
    const normalizedFilter = filterValue.trim().toLowerCase();
    if (!normalizedFilter) return memories;
    return memories.filter((memory) => {
      const haystack = `${memory.title} ${memory.summary} ${
        memory.tags?.join(' ') ?? ''
      }`.toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [filterValue, memories]);

  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : undefined;
  const totalPages = effectivePageSize
    ? Math.max(1, Math.ceil(filteredMemories.length / effectivePageSize))
    : 1;
  const safePage = Math.min(page, totalPages - 1);
  const paginatedMemories = effectivePageSize
    ? filteredMemories.slice(
        safePage * effectivePageSize,
        safePage * effectivePageSize + effectivePageSize
      )
    : filteredMemories;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.controls}>
          {scopeSelector && (
            <label className={styles.small}>
              {scopeSelector.label ?? 'Scope'}:{' '}
              <select
                value={scopeSelector.value}
                onChange={(e) => scopeSelector.onChange(e.target.value)}
              >
                    {scopeSelector.options.map(({label, value}) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
              </select>
            </label>
          )}
          <input
            type='search'
            placeholder='Filter text or tags'
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            className={styles.filter}
          />
          {onRefresh && (
            <button type='button' onClick={onRefresh} className={styles.small}>
              Refresh
            </button>
          )}
        </div>
      </div>
      {effectivePageSize && (
        <div className={styles.pageSummary}>
          Showing{' '}
          {filteredMemories.length === 0
            ? 0
            : `${safePage * effectivePageSize + 1}-${Math.min(
                filteredMemories.length,
                (safePage + 1) * effectivePageSize
              )}`}{' '}
          of {filteredMemories.length} memories
          {scopeSummaryLabel ? ` from ${scopeSummaryLabel}` : ''}.
        </div>
      )}
      {filteredMemories.length === 0 ? (
        <p className={styles.empty}>
          {emptyState}
        </p>
      ) : (
        <>
          <ul className={effectivePageSize ? `${styles.list} ${styles.paged}` : styles.list}>
            {paginatedMemories.map((memory) => (
              <li
                key={memory.id}
                className={
                  highlightDocumentId && memory.documentId === highlightDocumentId
                    ? `${styles.memory} ${styles.highlighted}`
                    : styles.memory
                }
              >
                <div className={styles.memoryHeader}>
                  <strong className={styles.memoryTitle}>
                    {memory.title || 'Untitled memory'}
                  </strong>
                  {showDelete && onDeleteMemory && (
                    <button
                      type='button'
                      onClick={() => onDeleteMemory(memory.id)}
                      className={styles.small}
                    >
                      Delete
                    </button>
                  )}
                  {renderMemoryActions && (
                    <div className={styles.memoryActions}>
                      {renderMemoryActions(memory)}
                    </div>
                  )}
                </div>
                <p className={styles.memorySummary}>
                  {memory.summary}
                </p>
                <small className={styles.meta}>
                  {new Date(memory.createdAt).toLocaleString()}
                  {memory.tags?.length ? ` · ${memory.tags.join(', ')}` : ''}
                  {renderSourceLabel && (
                    <>
                      {' · '}
                      {renderSourceLabel(memory)}
                    </>
                  )}
                </small>
              </li>
            ))}
          </ul>
          {effectivePageSize && totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type='button'
                disabled={safePage === 0}
                onClick={() => setPage((prev) => (prev <= 0 ? 0 : prev - 1))}
              >
                Previous
              </button>
              <span className={styles.pageLabel}>
                Page {safePage + 1} / {totalPages}
              </span>
              <button
                type='button'
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((prev) => (prev >= totalPages - 1 ? prev : prev + 1))
                }
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
