import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ProjectAISettings, WritingDocument} from '../entityTypes';
import type {EditorSelectionActions} from '../components/Editor/SelectionMenuAIEntries';
import type {WorkspacePendingAIInsert} from './useWorkspaceContextActions';
import {
  getAliasesByProject,
  getCanonicalFactsByProject,
  getCharactersByProject,
  getEntitiesByProject,
  getLoreFactProposalsByProject
} from '../services/storage';
import {getCanonicalFactsValidAtScene} from '../services/lore/canonicalFactValidity';
import {isAcceptedFact} from '../services/characterLab/characterVoiceContext';
import {sceneCheckText} from '../services/consistency/modelCanonCheck';
import {
  buildSelectionActionPrompt,
  cleanReplaceResult,
  menuSelectionActions,
  selectActionRecords,
  selectionActionFeature,
  type SelectionActionRecord
} from '../services/assistant/selectionActions';
import {LLMService} from '../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../services/llm/modelRun';
import {describeRouteDataFlow} from '../services/llm/providerRoute';
import {buildAITextProvenance} from '../services/editor/aiTextProvenance';
import {describeError} from '../services/errors';
import {getCharacterLabProviderIssue} from '../components/CharacterLab/characterLabProvider';
import {useConsultationBudget} from './useConsultationBudget';
import {useModelRun} from './useModelRun';

export interface SelectionActionNote {
  actionName: string;
  /** What the note is about, shown above it in the reader. */
  question: string;
  content: string;
}

const snippet = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}…` : flat;
};

/**
 * Runs custom AI actions from the selection menu (Slice 5.19). One run at a time, author-invoked.
 * A `replace` result becomes a scene revision preview that changes the scene only on Confirm and
 * refuses if the scene changed meanwhile; a `note` result opens in the reply reader. Each run
 * spends one consultation under its own feature, which `LLMService` refuses when that feature's AI
 * switch is off.
 */
export function useSelectionActionRun(params: {
  projectId: string | null;
  aiSettings: ProjectAISettings | undefined;
  documentId: string | null;
  sceneTitle: string;
  /** The scene HTML the editor shows; a rewrite applies only while the scene still matches it. */
  content: string;
  documents: WritingDocument[];
  setPendingAIInsert: (insert: WorkspacePendingAIInsert) => void;
  onSceneRevisionPreview: () => void;
}) {
  const {projectId, aiSettings, documentId, sceneTitle, content, documents, setPendingAIInsert, onSceneRevisionPreview} =
    params;
  const modelRun = useModelRun();
  const budget = useConsultationBudget(projectId, aiSettings?.inspectorSettings, aiSettings);
  const [actionName, setActionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<SelectionActionNote | null>(null);
  const actions = useMemo(() => menuSelectionActions(aiSettings), [aiSettings]);
  const disclosure = budget.route.kind === 'hosted'
    ? describeRouteDataFlow(budget.route, 'the selected text, and the scene or World Bible records an action includes,')
    : null;
  // A run that finishes after the author moved to another scene must not preview there.
  const documentIdRef = useRef(documentId);
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  const dismiss = useCallback(() => {
    modelRun.reset();
    setActionName(null);
    setError(null);
    setMessage(null);
  }, [modelRun]);

  const run = useCallback<EditorSelectionActions['onRun']>(async (actionId, selection) => {
    const action = actions.find((entry) => entry.id === actionId);
    if (!action || !aiSettings || !projectId || !documentId || modelRun.isRunning) return;
    setActionName(action.name);
    setError(null);
    setMessage(null);
    const providerIssue = getCharacterLabProviderIssue(aiSettings);
    if (providerIssue) {
      setError(providerIssue);
      return;
    }
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    const sourceContent = content;
    try {
      let records: SelectionActionRecord[] | null = null;
      if (action.includeWorldBible) {
        const [entities, characters, aliases, facts, proposals] = await Promise.all([
          getEntitiesByProject(projectId),
          getCharactersByProject(projectId),
          getAliasesByProject(projectId),
          getCanonicalFactsByProject(projectId),
          getLoreFactProposalsByProject(projectId)
        ]);
        const statusById = new Map(proposals.map((proposal) => [proposal.id, proposal.status]));
        records = selectActionRecords({
          selectedText: selection.passage,
          entities,
          characters,
          aliases,
          facts: getCanonicalFactsValidAtScene(facts, documentId, documents).filter((fact) =>
            isAcceptedFact(fact, statusById)
          ),
          includeLinkedRecords: Boolean(aiSettings.includeLinkedRecords)
        });
      }
      const prompt = buildSelectionActionPrompt({
        action,
        selectedText: selection.passage,
        scene: action.includeScene ? {title: sceneTitle, text: sceneCheckText(sourceContent)} : null,
        records
      });
      const feature = selectionActionFeature(action.output);
      budget.spend(feature);
      const result = await modelRun.run(new LLMService(aiSettings), {
        feature,
        systemPrompt: prompt.systemPrompt,
        messages: prompt.messages,
        maxTokens: resolveResponseTokenLimit(aiSettings.provider, aiSettings.inspectorSettings?.maxResponseTokens),
        cache: false
      });
      if (result.stopped) {
        setMessage('Stopped. Nothing changed.');
        return;
      }
      if (action.output === 'note') {
        setNote({actionName: action.name, question: `${action.name}: “${snippet(selection.selectedText)}”`, content: result.answer.trim()});
        return;
      }
      const text = cleanReplaceResult(result.answer);
      if (!text) {
        setError('The model returned no rewrite. Nothing changed.');
        return;
      }
      if (documentIdRef.current !== documentId) {
        setMessage('You moved to another scene, so the rewrite was not previewed. Nothing changed.');
        return;
      }
      const range = {from: selection.from, to: selection.to};
      const provenance = buildAITextProvenance('ai-action', aiSettings, budget.route);
      onSceneRevisionPreview();
      setPendingAIInsert({
        text,
        context: range,
        provenance,
        revision: {projectId, documentId, sourceContent, selectedText: selection.selectedText, range, text, provenance}
      });
      setMessage(`${action.name}: review the rewrite in the preview at the top of the editor. The scene changes only when you confirm.`);
    } catch (runError) {
      setError(describeError(runError, `${action.name} could not finish.`));
    }
  }, [actions, aiSettings, budget, content, documentId, documents, modelRun, onSceneRevisionPreview, projectId, sceneTitle, setPendingAIInsert]);

  const menu: EditorSelectionActions | undefined = actions.length > 0
    ? {actions: actions.map(({id, name}) => ({id, name})), disclosure, busy: modelRun.isRunning, onRun: (id, selection) => void run(id, selection)}
    : undefined;

  return {menu, actionName, modelRun, budget, disclosure, error, message, note, closeNote: () => setNote(null), dismiss};
}

export type SelectionActionRunController = ReturnType<typeof useSelectionActionRun>;
