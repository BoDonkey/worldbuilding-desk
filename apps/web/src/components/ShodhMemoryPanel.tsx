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
    <div
      style={{
        marginTop: '1.25rem',
        borderTop: '1px solid #e5e7eb',
        paddingTop: '1rem'
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
            style={{minWidth: '180px'}}
          />
          {onRefresh && (
            <button type='button' onClick={onRefresh} style={{fontSize: '0.85rem'}}>
              Refresh
            </button>
          )}
        </div>
      </div>
      {effectivePageSize && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            color: '#555'
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
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  backgroundColor:
                    highlightDocumentId && memory.documentId === highlightDocumentId
                      ? '#f9fafb'
                      : '#fff'
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
                <small style={{color: '#555'}}>
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
