import React, {useEffect, useMemo, useState} from 'react';
import type {MemoryEntry} from '../services/shodh/ShodhMemoryService';

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
  activeFilterLabel?: string | null;
  onClearFilter?: () => void;
  scopeSelector?: ScopeSelectorProps;
  scopeSummaryLabel?: string;
  highlightDocumentId?: string | null;
  onRefresh?: () => void;
  pageSize?: number;
  showDelete?: boolean;
  onDeleteMemory?: (id: string) => void;
  emptyState?: string;
  renderMemoryBadges?: (memory: MemoryEntry) => React.ReactNode;
  renderSourceLabel?: (memory: MemoryEntry) => React.ReactNode;
  renderMemoryActions?: (memory: MemoryEntry) => React.ReactNode;
  embedded?: boolean;
}

export const ShodhMemoryPanel: React.FC<ShodhMemoryPanelProps> = ({
  title = 'Canon memories',
  memories,
  filterValue,
  onFilterChange,
  activeFilterLabel,
  onClearFilter,
  scopeSelector,
  scopeSummaryLabel,
  highlightDocumentId,
  onRefresh,
  pageSize = 5,
  showDelete = false,
  onDeleteMemory,
  emptyState = 'No memories captured yet.',
  renderMemoryBadges,
  renderSourceLabel,
  renderMemoryActions,
  embedded = false
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
    <div
      style={{
        marginTop: embedded ? 0 : '1.25rem',
        borderTop: embedded ? 'none' : '1px solid #e5e7eb',
        paddingTop: embedded ? 0 : '1rem'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}
      >
        <h3 style={{margin: 0}}>{title}</h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center'
          }}
        >
          {scopeSelector && (
            <label style={{fontSize: '0.85rem'}}>
              {scopeSelector.label ?? 'Scope'}:{' '}
              <select
                value={scopeSelector.value}
                onChange={(e) => scopeSelector.onChange(e.target.value)}
                style={{
                  borderRadius: '10px',
                  border: '1px solid var(--surface-border-soft)',
                  background: 'var(--surface-panel-elevated)',
                  color: 'var(--color-text-primary)'
                }}
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
            style={{
              minWidth: '180px',
              borderRadius: '10px',
              border: '1px solid var(--surface-border-soft)',
              background: 'var(--surface-panel-elevated)',
              color: 'var(--color-text-primary)'
            }}
          />
          {onRefresh && (
            <button type='button' onClick={onRefresh} style={{fontSize: '0.85rem'}}>
              Refresh
            </button>
          )}
        </div>
      </div>
      {activeFilterLabel && onClearFilter && (
        <div
          style={{
            marginTop: '0.55rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.45rem',
            alignItems: 'center'
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--badge-info-bg) 78%, var(--surface-panel-elevated) 22%)',
              color: 'var(--badge-info-text)',
              fontSize: '0.76rem',
              fontWeight: 700
            }}
          >
            Filtered by {activeFilterLabel}
          </span>
          <button type='button' onClick={onClearFilter} style={{fontSize: '0.8rem'}}>
            Clear filter
          </button>
        </div>
      )}
      {effectivePageSize && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)'
          }}
        >
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
        <p style={{fontSize: '0.9rem', fontStyle: 'italic', marginTop: '0.75rem'}}>
          {emptyState}
        </p>
      ) : (
        <>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0.75rem 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              maxHeight: effectivePageSize ? 240 : 'none',
              overflowY: effectivePageSize ? 'auto' : 'visible'
            }}
          >
            {paginatedMemories.map((memory) => (
              <li
                key={memory.id}
                style={{
                  border: '1px solid var(--surface-border-soft)',
                  borderRadius: '14px',
                  padding: '0.7rem',
                  backgroundColor:
                    highlightDocumentId && memory.documentId === highlightDocumentId
                      ? 'color-mix(in srgb, var(--badge-info-bg) 22%, var(--surface-panel-elevated) 78%)'
                      : 'var(--surface-panel-elevated)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <strong style={{fontSize: '0.95rem'}}>
                    {memory.title || 'Untitled memory'}
                  </strong>
                  {showDelete && onDeleteMemory && (
                    <button
                      type='button'
                      onClick={() => onDeleteMemory(memory.id)}
                      style={{fontSize: '0.8rem'}}
                    >
                      Delete
                    </button>
                  )}
                  {renderMemoryActions && (
                    <div style={{display: 'flex', gap: '0.25rem'}}>
                      {renderMemoryActions(memory)}
                    </div>
                  )}
                </div>
                <p style={{margin: '0.25rem 0', whiteSpace: 'pre-wrap'}}>
                  {memory.summary}
                </p>
                {renderMemoryBadges && (
                  <div style={{marginBottom: '0.35rem'}}>{renderMemoryBadges(memory)}</div>
                )}
                <small style={{color: 'var(--color-text-secondary)'}}>
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              <button
                type='button'
                disabled={safePage === 0}
                onClick={() => setPage((prev) => (prev <= 0 ? 0 : prev - 1))}
              >
                Previous
              </button>
              <span style={{alignSelf: 'center', fontSize: '0.85rem'}}>
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
