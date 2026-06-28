import {getCategoriesByProject} from '../../categoryStorage';
import {getEntitiesByProject} from '../../entityStorage';
import type {
  CanonicalFact,
  LoreDocumentLink,
  Project,
  StoredRuleset,
  WorldEntity
} from '../../entityTypes';
import {getLoreDocumentLinksByProject, getLoreDocumentsByProject} from '../../loreStorage';
import {getDocumentsByProject} from '../../writingStorage';
import {getCanonicalFactsByProject} from '../lore/loreFactStorage';
import {buildCanonicalFactSummary} from '../lore/canonicalFactActions';
import type {RAGProvider} from '../rag/RAGService';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {emitShodhMemoriesUpdated} from '../shodh/shodhEvents';
import {extractPlainTextFromRichText} from '../worldBible/worldBibleEntityHelpers';
import {getRulesetByProjectId} from '../rules/rulesetService';

export interface ContextHealthRebuildResult {
  scenes: number;
  worldRecords: number;
  loreDocuments: number;
  canonFacts: number;
  rulesets: number;
  shodhMemories: number;
}

const buildEntityContent = (entity: WorldEntity) => {
  const fieldText = Object.entries(entity.fields)
    .map(([key, value]) =>
      `${key}: ${typeof value === 'string' ? extractPlainTextFromRichText(value) : value ?? ''}`
    )
    .join('\n');
  return `${entity.name}\n${fieldText}`;
};

const buildRulesetContent = (ruleset: StoredRuleset) => {
  const ruleText = ruleset.rules
    .map((rule) => `${rule.name}: ${rule.description || ''}`)
    .join('\n');
  return `${ruleset.description ?? ''}\n${ruleText}`.trim();
};

const getFactTargetId = (fact: CanonicalFact) => fact.targetId;

export async function rebuildProjectContextHealth(params: {
  project: Project;
  ragService: RAGProvider;
  shodhService: ShodhMemoryProvider;
}): Promise<ContextHealthRebuildResult> {
  const {project, ragService, shodhService} = params;
  const [
    scenes,
    categories,
    entities,
    loreDocuments,
    loreLinks,
    canonicalFacts,
    ruleset
  ] = await Promise.all([
    getDocumentsByProject(project.id),
    getCategoriesByProject(project.id),
    getEntitiesByProject(project.id),
    getLoreDocumentsByProject(project.id),
    getLoreDocumentLinksByProject(project.id),
    getCanonicalFactsByProject(project.id),
    getRulesetByProjectId(project.id)
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const linksByDocumentId = new Map<string, LoreDocumentLink[]>();
  loreLinks.forEach((link) => {
    const current = linksByDocumentId.get(link.loreDocumentId) ?? [];
    current.push(link);
    linksByDocumentId.set(link.loreDocumentId, current);
  });

  let shodhMemories = 0;

  for (const scene of scenes) {
    await ragService.indexDocument(
      scene.id,
      scene.title || 'Untitled scene',
      scene.content,
      'scene'
    );
    await shodhService.captureAutoMemory({
      projectId: project.id,
      documentId: scene.id,
      title: scene.title || 'Untitled scene',
      content: scene.content,
      tags: ['scene']
    });
    shodhMemories += 1;
  }

  for (const entity of entities) {
    const category = categoryById.get(entity.categoryId);
    const content = buildEntityContent(entity);
    await ragService.indexDocument(entity.id, entity.name, content, 'worldbible', {
      tags: category ? [category.slug] : ['worldbible'],
      entityIds: [entity.id]
    });
    await shodhService.captureAutoMemory({
      projectId: project.id,
      documentId: entity.id,
      title: entity.name,
      content,
      tags: ['worldbible', category?.slug ?? 'uncategorized']
    });
    shodhMemories += 1;
  }

  for (const document of loreDocuments) {
    const links = linksByDocumentId.get(document.id) ?? [];
    await ragService.indexDocument(
      `lore:${document.id}`,
      document.title,
      document.content,
      'lore',
      {
        tags: [document.kind, 'lore'],
        entityIds: links.map((link) => link.targetId)
      }
    );
  }

  for (const fact of canonicalFacts) {
    await ragService.indexDocument(
      `canon-fact:${fact.id}`,
      fact.targetName ?? fact.targetId,
      buildCanonicalFactSummary(fact),
      'canon_fact',
      {
        tags: ['canon_fact', fact.factType],
        entityIds: [getFactTargetId(fact)]
      }
    );
  }

  if (ruleset) {
    const content = buildRulesetContent(ruleset);
    await ragService.indexDocument(ruleset.id, ruleset.name || 'Ruleset', content, 'rule', {
      tags: ['ruleset']
    });
    await shodhService.captureAutoMemory({
      projectId: project.id,
      documentId: ruleset.id,
      title: ruleset.name || 'Ruleset',
      content,
      tags: ['ruleset']
    });
    shodhMemories += 1;
  }

  emitShodhMemoriesUpdated();

  return {
    scenes: scenes.length,
    worldRecords: entities.length,
    loreDocuments: loreDocuments.length,
    canonFacts: canonicalFacts.length,
    rulesets: ruleset ? 1 : 0,
    shodhMemories
  };
}
