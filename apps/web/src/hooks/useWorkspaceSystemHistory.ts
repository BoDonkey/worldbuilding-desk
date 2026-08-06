import {useCallback, useState} from 'react';
import type {SystemHistoryEntry} from '../entityTypes';
import {
  appendSystemHistoryEntry,
  getSystemHistoryEntries
} from '../services/system';

export function useWorkspaceSystemHistory(activeProjectId: string | null) {
  const [systemHistoryEntries, setSystemHistoryEntries] = useState<SystemHistoryEntry[]>([]);

  const refreshSystemHistory = useCallback(() => {
    if (!activeProjectId) {
      setSystemHistoryEntries([]);
      return;
    }
    setSystemHistoryEntries(getSystemHistoryEntries(activeProjectId));
  }, [activeProjectId]);

  const addSystemHistory = useCallback((input: {
    category: SystemHistoryEntry['category'];
    message: string;
    insertText?: string;
    sourceKey?: string;
    sceneId?: string;
    createdAt?: number;
  }) => {
    if (!activeProjectId) return;
    appendSystemHistoryEntry(activeProjectId, input);
    refreshSystemHistory();
  }, [activeProjectId, refreshSystemHistory]);

  return {systemHistoryEntries, refreshSystemHistory, addSystemHistory};
}
