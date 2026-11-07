import {useState} from 'react';
import {ShodhMemoryPanel} from '../../ShodhMemoryPanel';
import type {MemoryEntry} from '../../../services/shodh/ShodhMemoryService';
import {promoteMemoryToParent} from '../../../services/seriesBible/SeriesBibleService';
import {describeError} from '../../../services/errors';
import type {SetRecordFeedback} from './recordTypes';

interface WorldBibleCanonSummaryProps {
  projectId: string;
  editingId: string;
  memories: MemoryEntry[];
  refreshMemories: () => Promise<unknown>;
  seriesParentProjectId: string | null;
  setFeedback: SetRecordFeedback;
}

const EMPTY_STATE =
  'This entry has no captured memories yet. Save it to generate one or adjust the filter.';

/**
 * The open record's captured memories. In a series, local memories can be
 * promoted to the parent project's canon.
 */
export function WorldBibleCanonSummary({
  projectId,
  editingId,
  memories,
  refreshMemories,
  seriesParentProjectId,
  setFeedback
}: WorldBibleCanonSummaryProps) {
  const [memoryFilter, setMemoryFilter] = useState('');
  const [promotingMemoryId, setPromotingMemoryId] = useState<string | null>(null);

  const handlePromoteMemory = async (memory: MemoryEntry) => {
    if (!seriesParentProjectId) return;
    setPromotingMemoryId(memory.id);
    setFeedback(null);
    try {
      await promoteMemoryToParent(memory, seriesParentProjectId);
      await refreshMemories();
      setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to promote memory.');
      setFeedback({tone: 'error', message});
    } finally {
      setPromotingMemoryId(null);
    }
  };

  return (
    <ShodhMemoryPanel
      title='Canon summary'
      memories={memories}
      filterValue={memoryFilter}
      onFilterChange={setMemoryFilter}
      highlightDocumentId={editingId}
      onRefresh={() => void refreshMemories()}
      pageSize={0}
      scopeSummaryLabel='this entry'
      emptyState={EMPTY_STATE}
      renderSourceLabel={(memory) =>
        memory.projectId === projectId ? 'Local' : 'Parent'
      }
      renderMemoryActions={(memory) => {
        if (
          seriesParentProjectId &&
          memory.projectId === projectId
        ) {
          return (
            <button
              type='button'
              onClick={() => void handlePromoteMemory(memory)}
              disabled={promotingMemoryId === memory.id}
              style={{fontSize: '0.8rem'}}
            >
              {promotingMemoryId === memory.id ? 'Promoting...' : 'Promote'}
            </button>
          );
        }
        return null;
      }}
    />
  );
}
