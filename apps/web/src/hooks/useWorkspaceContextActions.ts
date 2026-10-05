import {useCallback, useState} from 'react';
import type {SceneRevision} from '../services/assistant/sceneRevision';
import type {ProjectSettings} from '../entityTypes';
import type {LoreInspectorRecord} from '../components/Editor/LoreInspectorPanel';
import {useConsultationBudget} from './useConsultationBudget';
import type {WorkspaceContextDrawerView} from './useWorkspaceDrawers';
import {
  buildWorkspaceLoreConsultation,
  summarizeWorkspaceContent,
  type WorkspaceLoreConsultationMode
} from '../services/workspace/workspaceConsultation';
import type {AITextProvenance} from '../services/editor/aiTextProvenance';

export interface WorkspaceAIContext {
  type: 'document';
  id: string;
  selectedText?: string;
  sourceContent?: string;
  from: number;
  to: number;
}

export interface WorkspacePendingAIInsert {
  revision?: SceneRevision;
  text: string;
  context: {from: number; to: number} | null;
  /** Present when a model wrote `text`; the inserted text is marked as AI text. */
  provenance?: AITextProvenance;
}

export {summarizeWorkspaceContent as summarizeContent};

export function useWorkspaceContextActions(params: {
  activeProjectId: string | null;
  projectSettings: ProjectSettings | null;
  content: string;
  selectedId: string | null;
  openContextDrawer: (view: WorkspaceContextDrawerView) => void;
  onSceneRevisionPreview: () => void;
}) {
  const {
    activeProjectId,
    projectSettings,
    content,
    selectedId,
    openContextDrawer,
    onSceneRevisionPreview
  } = params;
  const [activeAIContext, setActiveAIContext] = useState<WorkspaceAIContext | null>(null);
  const [queuedAssistantPrompt, setQueuedAssistantPrompt] = useState<string | null>(null);
  const [activeLoreRecord, setActiveLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [pendingAIInsert, setPendingAIInsert] =
    useState<WorkspacePendingAIInsert | null>(null);
  /** Model-written prose (character scene, scene draft) for a marked, undoable insert at the cursor. */
  const insertAIProse = useCallback(
    (html: string, provenance: AITextProvenance) => setPendingAIInsert({text: html, context: null, provenance}),
    []
  );
  const consultationBudget = useConsultationBudget(
    activeProjectId,
    projectSettings?.aiSettings?.inspectorSettings,
    projectSettings?.aiSettings
  );

  const handleOpenAIContext = useCallback(
    (context: WorkspaceAIContext, prompt?: string | null) => {
      setActiveAIContext({...context, sourceContent: content});
      if (prompt !== undefined) {
        setQueuedAssistantPrompt(prompt);
      }
      openContextDrawer('ai');
    },
    [openContextDrawer, content]
  );

  const previewSceneRevision = useCallback((text: string, provenance?: AITextProvenance) => {
    if (!activeProjectId || !selectedId || !text.trim()) return;
    const replacesSelection = activeAIContext?.id === selectedId && activeAIContext.from !== activeAIContext.to;
    const range = replacesSelection ? {from: activeAIContext.from, to: activeAIContext.to} : null;
    onSceneRevisionPreview();
    setPendingAIInsert({text, context: range, revision: {
      text, projectId: activeProjectId, documentId: selectedId,
      sourceContent: replacesSelection ? (activeAIContext.sourceContent ?? '') : content,
      selectedText: replacesSelection ? (activeAIContext.selectedText ?? '') : '',
      range,
      ...(provenance ? {provenance} : {})
    }});
  }, [activeProjectId, selectedId, activeAIContext, content, onSceneRevisionPreview]);

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
    if (consultationBudget.blocked) return;

    consultationBudget.spend('workspace-context');

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
    consultationBudget,
    content,
    handleOpenAIContext,
    projectSettings?.aiSettings?.inspectorSettings,
    selectedId
  ]);

  return {
    activeAIContext,
    pendingAIInsert,
    previewSceneRevision,
    setPendingAIInsert,
    insertAIProse,
    queuedAssistantPrompt,
    setQueuedAssistantPrompt,
    activeLoreRecord,
    consultationBudget,
    resetContextActions,
    handleOpenAIContext,
    handleOpenLoreInspector,
    handleConsultationFromLore
  };
}
