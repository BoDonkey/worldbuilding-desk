import {useCallback, useEffect, useState} from 'react';
import type {ProjectSettings} from '../entityTypes';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import {
  getInspectorConsultationUsage,
  incrementInspectorConsultationUsage
} from '../services/editor';
import type {WorkspaceContextDrawerView} from './useWorkspaceDrawers';
import {
  buildWorkspaceLoreConsultation,
  summarizeWorkspaceContent,
  type WorkspaceLoreConsultationMode
} from '../services/workspace/workspaceConsultation';

export interface WorkspaceAIContext {
  type: 'document';
  id: string;
  selectedText?: string;
  from: number;
  to: number;
}

export interface WorkspacePendingAIInsert {
  text: string;
  context: {from: number; to: number} | null;
}

export {summarizeWorkspaceContent as summarizeContent};

export function useWorkspaceContextActions(params: {
  activeProjectId: string | null;
  projectSettings: ProjectSettings | null;
  content: string;
  selectedId: string | null;
  openContextDrawer: (view: WorkspaceContextDrawerView) => void;
}) {
  const {
    activeProjectId,
    projectSettings,
    content,
    selectedId,
    openContextDrawer
  } = params;
  const [activeAIContext, setActiveAIContext] = useState<WorkspaceAIContext | null>(null);
  const [queuedAssistantPrompt, setQueuedAssistantPrompt] = useState<string | null>(null);
  const [activeLoreRecord, setActiveLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [aiBudgetUsed, setAIBudgetUsed] = useState(0);
  const [pendingAIInsert, setPendingAIInsert] =
    useState<WorkspacePendingAIInsert | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setAIBudgetUsed(0);
      return;
    }
    setAIBudgetUsed(getInspectorConsultationUsage(activeProjectId));
  }, [activeProjectId]);

  const handleOpenAIContext = useCallback(
    (context: WorkspaceAIContext, prompt?: string | null) => {
      setActiveAIContext(context);
      if (prompt !== undefined) {
        setQueuedAssistantPrompt(prompt);
      }
      openContextDrawer('ai');
    },
    [openContextDrawer]
  );

  const handleOpenLoreInspector = useCallback((record: LoreInspectorRecord) => {
    setActiveLoreRecord(record);
    openContextDrawer('lore');
  }, [openContextDrawer]);

  const resetContextActions = useCallback(() => {
    setActiveAIContext(null);
    setQueuedAssistantPrompt(null);
    setActiveLoreRecord(null);
    setPendingAIInsert(null);
  }, []);

  const handleConsultationFromLore = useCallback((mode: WorkspaceLoreConsultationMode) => {
    if (!activeProjectId || !activeLoreRecord) return;
    const inspector = projectSettings?.aiSettings?.inspectorSettings;
    if (inspector?.enableAIConsultation === false) return;
    const maxConsultations = inspector?.maxConsultationsPerDay ?? 20;
    const used = getInspectorConsultationUsage(activeProjectId);
    if (used >= maxConsultations) return;

    const nextUsed = incrementInspectorConsultationUsage(activeProjectId);
    setAIBudgetUsed(nextUsed);

    const maxContextChars = inspector?.maxContextChars ?? 1800;
    const {compactContext, prompt} = buildWorkspaceLoreConsultation({
      mode,
      record: activeLoreRecord,
      content,
      maxContextChars
    });

    handleOpenAIContext(
      {
        type: 'document',
        id: selectedId || activeProjectId,
        selectedText: compactContext,
        from: 0,
        to: 0
      },
      prompt
    );
  }, [
    activeLoreRecord,
    activeProjectId,
    content,
    handleOpenAIContext,
    projectSettings?.aiSettings?.inspectorSettings,
    selectedId
  ]);

  return {
    activeAIContext,
    pendingAIInsert,
    setPendingAIInsert,
    queuedAssistantPrompt,
    setQueuedAssistantPrompt,
    activeLoreRecord,
    aiBudgetUsed,
    resetContextActions,
    handleOpenAIContext,
    handleOpenLoreInspector,
    handleConsultationFromLore
  };
}
