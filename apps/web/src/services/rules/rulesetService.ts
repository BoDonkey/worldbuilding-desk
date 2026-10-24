import {quarantineInvalidRules, type WorldRuleset} from '@worldbuilding-desk/rules-engine';
import type {StoredRuleset} from '../../entityTypes';
import {getRAGService} from '../rag/getRAGService';
import {getShodhService} from '../shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../shodh/shodhEvents';
import {
  deleteRulesetRecord,
  getRuleset,
  putRulesetRecord
} from '../storage';

/**
 * Every ruleset write goes through here, so stored `rules` always satisfy
 * GameRuleSchema: invalid rules from imports or older data are kept in
 * `quarantinedRules` and left out of indexed context. Resolves to the ruleset
 * as stored.
 */
export async function saveRuleset(
  input: WorldRuleset,
  projectId: string
): Promise<WorldRuleset> {
  const ruleset: WorldRuleset = quarantineInvalidRules(input);
  const storedRuleset: StoredRuleset = {
    ...ruleset,
    projectId
  };

  await putRulesetRecord(storedRuleset);
  const ruleText = ruleset.rules
    .map((rule) => `${rule.name}: ${rule.description || ''}`)
    .join('\n');
  const combinedText = `${ruleset.description ?? ''}\n${ruleText}`;

  try {
    const rag = await getRAGService(projectId);
    await rag.indexDocument(
      storedRuleset.id,
      ruleset.name || 'Ruleset',
      combinedText,
      'rule',
      {tags: ['ruleset']}
    );
  } catch (error) {
    console.warn('Failed to add ruleset to indexed context', error);
  }
  try {
    const shodh = await getShodhService(projectId);
    await shodh.captureAutoMemory({
      projectId,
      documentId: storedRuleset.id,
      title: ruleset.name || 'Ruleset',
      content: combinedText,
      tags: ['ruleset']
    });
  } catch (error) {
    console.warn('Failed to capture ruleset memory', error);
  }
  emitShodhMemoriesUpdated();
  return ruleset;
}

export async function deleteRuleset(
  rulesetId: string,
  projectId?: string
): Promise<void> {
  const existing = projectId ? null : await getRuleset(rulesetId);
  await deleteRulesetRecord(rulesetId);

  const cleanup = async () => {
    const targetProjectId = projectId ?? existing?.projectId;
    if (!targetProjectId) {
      return;
    }

    try {
      const shodh = await getShodhService(targetProjectId);
      await shodh.deleteMemoriesForDocument(rulesetId);
    } catch (error) {
      console.warn('Failed to delete ruleset memory', error);
    }

    try {
      const rag = await getRAGService(targetProjectId);
      await rag.deleteDocument(rulesetId);
    } catch (error) {
      console.warn('Failed to remove ruleset from indexed context', error);
    }
    emitShodhMemoriesUpdated();
  };

  await cleanup().catch((error) => {
    console.warn('Ruleset cleanup failed', error);
  });
}
