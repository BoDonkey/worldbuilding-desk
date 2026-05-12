import type {
  CanonDecisionCluster,
  CanonDecisionSuppression,
  ChapterCard,
  Character,
  CharacterSheet,
  CanonicalFact,
  CompendiumActionLog,
  CompendiumEntry,
  CompendiumMilestone,
  CompendiumProgress,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  LoreEntityProposal,
  LoreFactProposal,
  Project,
  ProjectSettings,
  StateMutationEvent,
  SettlementModule,
  SettlementState,
  ScratchpadDocument,
  UnlockableRecipe,
  WorldEntity,
  WritingDocument,
  ZoneAffinityProfile,
  ZoneAffinityProgress,
  StoredRuleset
} from '../../entityTypes';
import {
  openDb,
  CATEGORY_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CANON_DECISION_CLUSTER_STORE_NAME,
  CANON_DECISION_SUPPRESSION_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  SETTINGS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  SCRATCHPAD_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WRITING_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME
} from '../../db';
import {getProjectById} from '../../projectStorage';
import {getRulesetByProjectId} from '../rules/rulesetService';

export interface ProjectSnapshot {
  schemaVersion: 1;
  generatedAt: number;
  projectId: string;
  project: Project;
  data: {
    settings: ProjectSettings | null;
    ruleset: StoredRuleset | null;
    categories: EntityCategory[];
    entities: WorldEntity[];
    writingDocuments: WritingDocument[];
    scratchpads: ScratchpadDocument[];
    corkboardChapterCards: ChapterCard[];
    characters: Character[];
    characterSheets: CharacterSheet[];
    loreDocuments: LoreDocument[];
    loreDocumentLinks: LoreDocumentLink[];
    loreEntityProposals: LoreEntityProposal[];
    loreFactProposals: LoreFactProposal[];
    canonicalFacts: CanonicalFact[];
    canonDecisionClusters: CanonDecisionCluster[];
    canonDecisionSuppressions: CanonDecisionSuppression[];
    compendiumEntries: CompendiumEntry[];
    compendiumMilestones: CompendiumMilestone[];
    compendiumRecipes: UnlockableRecipe[];
    compendiumProgressRecords: CompendiumProgress[];
    compendiumActionLogs: CompendiumActionLog[];
    zoneAffinityProfiles: ZoneAffinityProfile[];
    zoneAffinityProgressRecords: ZoneAffinityProgress[];
    settlementModules: SettlementModule[];
    settlementStateRecords: SettlementState[];
    stateMutationEvents: StateMutationEvent[];
  };
  counts: {
    categories: number;
    entities: number;
    writingDocuments: number;
    scratchpads: number;
    corkboardChapterCards: number;
    characters: number;
    characterSheets: number;
    loreDocuments: number;
    loreDocumentLinks: number;
    loreEntityProposals: number;
    loreFactProposals: number;
    canonicalFacts: number;
    canonDecisionClusters: number;
    canonDecisionSuppressions: number;
    compendiumEntries: number;
    compendiumMilestones: number;
    compendiumRecipes: number;
    compendiumProgressRecords: number;
    compendiumActionLogs: number;
    zoneAffinityProfiles: number;
    zoneAffinityProgressRecords: number;
    settlementModules: number;
    settlementStateRecords: number;
    stateMutationEvents: number;
    hasSettings: boolean;
    hasRuleset: boolean;
  };
}

export interface SnapshotCountValidationResult {
  ok: boolean;
  mismatches: string[];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getProjectScopedRecords<T extends {projectId: string}>(
  storeName: string,
  projectId: string
): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const all = (await requestToPromise(store.getAll())) as T[];
  return all.filter((record) => record.projectId === projectId);
}

export async function buildProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" not found.`);
  }

  const [
    settingsRecords,
    ruleset,
    categories,
    entities,
    writingDocuments,
    scratchpads,
    corkboardChapterCards,
    characters,
    characterSheets,
    loreDocuments,
    loreDocumentLinks,
    loreEntityProposals,
    loreFactProposals,
    canonicalFacts,
    canonDecisionClusters,
    canonDecisionSuppressions,
    compendiumEntries,
    compendiumMilestones,
    compendiumRecipes,
    compendiumProgressRecords,
    compendiumActionLogs,
    zoneAffinityProfiles,
    zoneAffinityProgressRecords,
    settlementModules,
    settlementStateRecords,
    stateMutationEvents
  ] = await Promise.all([
    getProjectScopedRecords<ProjectSettings>(SETTINGS_STORE_NAME, projectId),
    getRulesetByProjectId(projectId),
    getProjectScopedRecords<EntityCategory>(CATEGORY_STORE_NAME, projectId),
    getProjectScopedRecords<WorldEntity>(ENTITY_STORE_NAME, projectId),
    getProjectScopedRecords<WritingDocument>(WRITING_STORE_NAME, projectId),
    getProjectScopedRecords<ScratchpadDocument>(SCRATCHPAD_STORE_NAME, projectId),
    getProjectScopedRecords<ChapterCard>(CORKBOARD_CHAPTER_CARD_STORE_NAME, projectId),
    getProjectScopedRecords<Character>(CHARACTER_STORE_NAME, projectId),
    getProjectScopedRecords<CharacterSheet>(CHARACTER_SHEET_STORE_NAME, projectId),
    getProjectScopedRecords<LoreDocument>(LORE_DOCUMENT_STORE_NAME, projectId),
    getProjectScopedRecords<LoreDocumentLink>(LORE_DOCUMENT_LINK_STORE_NAME, projectId),
    getProjectScopedRecords<LoreEntityProposal>(LORE_ENTITY_PROPOSAL_STORE_NAME, projectId),
    getProjectScopedRecords<LoreFactProposal>(LORE_FACT_PROPOSAL_STORE_NAME, projectId),
    getProjectScopedRecords<CanonicalFact>(CANONICAL_FACT_STORE_NAME, projectId),
    getProjectScopedRecords<CanonDecisionCluster>(CANON_DECISION_CLUSTER_STORE_NAME, projectId),
    getProjectScopedRecords<CanonDecisionSuppression>(
      CANON_DECISION_SUPPRESSION_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<CompendiumEntry>(COMPENDIUM_ENTRY_STORE_NAME, projectId),
    getProjectScopedRecords<CompendiumMilestone>(
      COMPENDIUM_MILESTONE_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<UnlockableRecipe>(COMPENDIUM_RECIPE_STORE_NAME, projectId),
    getProjectScopedRecords<CompendiumProgress>(
      COMPENDIUM_PROGRESS_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<CompendiumActionLog>(
      COMPENDIUM_ACTION_LOG_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<ZoneAffinityProfile>(
      ZONE_AFFINITY_PROFILE_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<ZoneAffinityProgress>(
      ZONE_AFFINITY_PROGRESS_STORE_NAME,
      projectId
    ),
    getProjectScopedRecords<SettlementModule>(SETTLEMENT_MODULE_STORE_NAME, projectId),
    getProjectScopedRecords<SettlementState>(SETTLEMENT_STATE_STORE_NAME, projectId),
    getProjectScopedRecords<StateMutationEvent>(STATE_MUTATION_EVENT_STORE_NAME, projectId)
  ]);

  const settings = settingsRecords[0] ?? null;

  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    projectId,
    project,
    data: {
      settings,
      ruleset,
      categories,
      entities,
      writingDocuments,
      scratchpads,
      corkboardChapterCards,
      characters,
      characterSheets,
      loreDocuments,
      loreDocumentLinks,
      loreEntityProposals,
      loreFactProposals,
      canonicalFacts,
      canonDecisionClusters,
      canonDecisionSuppressions,
      compendiumEntries,
      compendiumMilestones,
      compendiumRecipes,
      compendiumProgressRecords,
      compendiumActionLogs,
      zoneAffinityProfiles,
      zoneAffinityProgressRecords,
      settlementModules,
      settlementStateRecords,
      stateMutationEvents
    },
    counts: {
      categories: categories.length,
      entities: entities.length,
      writingDocuments: writingDocuments.length,
      scratchpads: scratchpads.length,
      corkboardChapterCards: corkboardChapterCards.length,
      characters: characters.length,
      characterSheets: characterSheets.length,
      loreDocuments: loreDocuments.length,
      loreDocumentLinks: loreDocumentLinks.length,
      loreEntityProposals: loreEntityProposals.length,
      loreFactProposals: loreFactProposals.length,
      canonicalFacts: canonicalFacts.length,
      canonDecisionClusters: canonDecisionClusters.length,
      canonDecisionSuppressions: canonDecisionSuppressions.length,
      compendiumEntries: compendiumEntries.length,
      compendiumMilestones: compendiumMilestones.length,
      compendiumRecipes: compendiumRecipes.length,
      compendiumProgressRecords: compendiumProgressRecords.length,
      compendiumActionLogs: compendiumActionLogs.length,
      zoneAffinityProfiles: zoneAffinityProfiles.length,
      zoneAffinityProgressRecords: zoneAffinityProgressRecords.length,
      settlementModules: settlementModules.length,
      settlementStateRecords: settlementStateRecords.length,
      stateMutationEvents: stateMutationEvents.length,
      hasSettings: Boolean(settings),
      hasRuleset: Boolean(ruleset)
    }
  };
}

export function serializeProjectSnapshot(snapshot: ProjectSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function validateSnapshotCounts(snapshot: ProjectSnapshot): SnapshotCountValidationResult {
  const mismatches: string[] = [];
  const expected = snapshot.counts;
  const actual = {
    categories: snapshot.data.categories.length,
    entities: snapshot.data.entities.length,
    writingDocuments: snapshot.data.writingDocuments.length,
    scratchpads: snapshot.data.scratchpads.length,
    corkboardChapterCards: snapshot.data.corkboardChapterCards.length,
    characters: snapshot.data.characters.length,
    characterSheets: snapshot.data.characterSheets.length,
    loreDocuments: snapshot.data.loreDocuments.length,
    loreDocumentLinks: snapshot.data.loreDocumentLinks.length,
    loreEntityProposals: snapshot.data.loreEntityProposals.length,
    loreFactProposals: snapshot.data.loreFactProposals.length,
    canonicalFacts: snapshot.data.canonicalFacts.length,
    canonDecisionClusters: snapshot.data.canonDecisionClusters.length,
    canonDecisionSuppressions: snapshot.data.canonDecisionSuppressions.length,
    compendiumEntries: snapshot.data.compendiumEntries.length,
    compendiumMilestones: snapshot.data.compendiumMilestones.length,
    compendiumRecipes: snapshot.data.compendiumRecipes.length,
    compendiumProgressRecords: snapshot.data.compendiumProgressRecords.length,
    compendiumActionLogs: snapshot.data.compendiumActionLogs.length,
    zoneAffinityProfiles: snapshot.data.zoneAffinityProfiles.length,
    zoneAffinityProgressRecords: snapshot.data.zoneAffinityProgressRecords.length,
    settlementModules: snapshot.data.settlementModules.length,
    settlementStateRecords: snapshot.data.settlementStateRecords.length,
    stateMutationEvents: snapshot.data.stateMutationEvents.length,
    hasSettings: Boolean(snapshot.data.settings),
    hasRuleset: Boolean(snapshot.data.ruleset)
  };

  const keys = Object.keys(actual) as Array<keyof typeof actual>;
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      mismatches.push(`${key}: expected ${String(expected[key])}, got ${String(actual[key])}`);
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches
  };
}

export function diffSnapshotCounts(params: {
  expected: ProjectSnapshot['counts'];
  actual: ProjectSnapshot['counts'];
}): string[] {
  const mismatches: string[] = [];
  const keys = Object.keys(params.expected) as Array<keyof ProjectSnapshot['counts']>;
  for (const key of keys) {
    if (params.expected[key] !== params.actual[key]) {
      mismatches.push(
        `${key}: exported ${String(params.expected[key])}, imported ${String(params.actual[key])}`
      );
    }
  }
  return mismatches;
}
