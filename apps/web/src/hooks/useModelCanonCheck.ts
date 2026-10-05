import {useCallback, useMemo, useState} from 'react';
import type {ProjectAISettings, WritingDocument} from '../entityTypes';
import {getEntitiesByProject} from '../entityStorage';
import {getCharactersByProject} from '../characterStorage';
import {getAliasesByProject} from '../services/consistency';
import {getCanonicalFactsByProject, getLoreFactProposalsByProject} from '../services/lore/loreFactStorage';
import {getCanonicalFactsValidAtScene} from '../services/lore/canonicalFactValidity';
import {isAcceptedFact} from '../services/characterLab/characterVoiceContext';
import {
  buildCanonCheckPrompt,
  buildModelCanonCheckItems,
  canonCheckSceneText,
  parseCanonCheckReply,
  selectCanonCheckFacts,
  validateCanonCheckCandidates,
  type CanonCheckEntity
} from '../services/consistency/modelCanonCheck';
import type {ConsistencyReviewItem} from '../services/consistency/reviewReadiness';
import {LLMService} from '../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../services/llm/modelRun';
import {describeRouteDataFlow} from '../services/llm/providerRoute';
import {describeError} from '../services/errors';
import {getCharacterLabProviderIssue} from '../components/CharacterLab/characterLabProvider';
import {useConsultationBudget} from './useConsultationBudget';
import {useModelRun} from './useModelRun';

export interface CanonCheckPreview {
  sceneId: string;
  items: ConsistencyReviewItem[];
  rejectedCount: number;
  factCount: number;
  truncated: boolean;
}

/**
 * **Check this scene against canon** (4.38). Author-triggered only: one scene
 * and the accepted facts about the entities it names go to the configured
 * provider; validated candidates are previewed, and only the author's
 * confirmation adds them to the review queue. Spends one `canon-check`
 * consultation per run.
 */
export function useModelCanonCheck(params: {
  projectId: string;
  aiSettings: ProjectAISettings | undefined;
  scene: {id: string; title: string; text: string} | null;
  documents: WritingDocument[];
  /** Adds confirmed items to the review queue, replacing the scene's earlier ones. */
  onAddItems: (sceneId: string, items: ConsistencyReviewItem[]) => void;
}) {
  const {projectId, aiSettings, scene, documents, onAddItems} = params;
  const modelRun = useModelRun();
  const inspector = aiSettings?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const budget = useConsultationBudget(projectId, inspector, aiSettings);
  const [preview, setPreview] = useState<CanonCheckPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providerIssue = useMemo(() => getCharacterLabProviderIssue(aiSettings), [aiSettings]);
  const disclosure = describeRouteDataFlow(
    budget.route,
    'this scene’s text and the accepted facts about the people and places it names'
  );
  const canCheck =
    Boolean(scene?.text.trim()) && consultationEnabled && !providerIssue && !modelRun.isRunning;

  const run = useCallback(async () => {
    if (!scene || !aiSettings || !canCheck) return;
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const [entities, characters, aliases, facts, proposals] = await Promise.all([
        getEntitiesByProject(projectId),
        getCharactersByProject(projectId),
        getAliasesByProject(projectId),
        getCanonicalFactsByProject(projectId),
        getLoreFactProposalsByProject(projectId)
      ]);
      const proposalStatusById = new Map(proposals.map((proposal) => [proposal.id, proposal.status]));
      const aliasesFor = (id: string) =>
        aliases.filter((alias) => alias.targetId === id).map((alias) => alias.alias);
      const checkEntities: CanonCheckEntity[] = [
        ...entities.map((entity) => ({id: entity.id, name: entity.name, aliases: aliasesFor(entity.id)})),
        ...characters.map((character) => ({id: character.id, name: character.name, aliases: aliasesFor(character.id)}))
      ];
      const validFacts = getCanonicalFactsValidAtScene(facts, scene.id, documents).filter((fact) =>
        isAcceptedFact(fact, proposalStatusById)
      );
      const checked = canonCheckSceneText(scene.text);
      const selected = selectCanonCheckFacts({sceneText: checked.text, entities: checkEntities, facts: validFacts});
      if (selected.length === 0) {
        setMessage('No accepted facts mention anyone in this scene, so there is nothing to check. No consultation was used.');
        return;
      }
      const prompt = buildCanonCheckPrompt({sceneTitle: scene.title, sceneText: checked.text, facts: selected});
      budget.spend('canon-check');
      const result = await modelRun.run(new LLMService(aiSettings), {
        systemPrompt: prompt.systemPrompt,
        messages: prompt.messages,
        maxTokens: resolveResponseTokenLimit(aiSettings.provider, inspector?.maxResponseTokens),
        cache: false
      });
      if (result.stopped) {
        setMessage('Stopped. Nothing was added to review.');
        return;
      }
      const {accepted, rejected} = validateCanonCheckCandidates({
        candidates: parseCanonCheckReply(result.answer),
        sceneText: checked.text,
        facts: selected
      });
      setPreview({
        sceneId: scene.id,
        items: buildModelCanonCheckItems({
          sceneId: scene.id,
          sceneTitle: scene.title,
          conflicts: accepted,
          provider: aiSettings.provider
        }),
        rejectedCount: rejected.length,
        factCount: selected.length,
        truncated: checked.truncated
      });
    } catch (runError) {
      setError(describeError(runError, 'The canon check could not finish.'));
    }
  }, [aiSettings, budget, canCheck, documents, inspector?.maxResponseTokens, modelRun, projectId, scene]);

  const confirm = useCallback(() => {
    if (!preview) return;
    onAddItems(preview.sceneId, preview.items);
    setMessage(
      `Added ${preview.items.length} possible conflict${preview.items.length === 1 ? '' : 's'} to review.`
    );
    setPreview(null);
  }, [onAddItems, preview]);

  const discard = useCallback(() => setPreview(null), []);

  return {
    run,
    confirm,
    discard,
    preview,
    message,
    error,
    canCheck,
    consultationEnabled,
    providerIssue,
    disclosure,
    modelRun,
    budget
  };
}

export type ModelCanonCheckController = ReturnType<typeof useModelCanonCheck>;
