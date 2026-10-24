/*
 * Public entry point for persistence (slice 3.23a). Code outside
 * services/storage imports repositories from here; the database connection
 * (db.ts) and request helpers stay internal. ESLint enforces this.
 */
// Store names are shared with transactional actions; openDb is not exported.
export {
  ENTITY_STORE_NAME,
  CATEGORY_STORE_NAME,
  PROJECT_STORE_NAME,
  WRITING_STORE_NAME,
  SCRATCHPAD_STORE_NAME,
  WORLD_CANVAS_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  SETTINGS_STORE_NAME,
  CHARACTER_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CANON_DECISION_CLUSTER_STORE_NAME,
  CANON_DECISION_SUPPRESSION_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  CONSISTENCY_PROPOSAL_STORE_NAME,
  CONSISTENCY_EVENT_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  PROJECT_REVIEW_RUN_STORE_NAME,
  MECHANICS_DRAFT_STORE_NAME
} from './db';
export * from './jsonTransfer';
export * from './projectWriteTransaction';
export * from './projectBackupExport';
export * from './projectBackupImport';
export * from './projectSnapshotService';
export * from './projectSchemaMigrations';
export * from './projectSnapshotMigrations';
export * from './repositories/aliasStorage';
export * from './repositories/canonDecisionStorage';
export * from './repositories/canonDecisionSuppressionStorage';
export * from './repositories/categoryStorage';
export * from './repositories/characterIdentityResolutionStorage';
export * from './repositories/characterIdentityStorage';
export * from './repositories/characterImportStorage';
export * from './repositories/characterSheetStorage';
export * from './repositories/mechanicsDraftStorage';
export * from './repositories/characterStorage';
export * from './repositories/compendiumStorage';
export * from './repositories/compendiumWorldStorage';
export * from './repositories/consistencyStorage';
export * from './repositories/corkboardStorage';
export * from './repositories/entityStorage';
export * from './repositories/itemStateStorage';
export * from './repositories/loreEntityProposalStorage';
export * from './repositories/loreFactStorage';
export * from './repositories/loreStorage';
export * from './repositories/projectReviewRunStorage';
export * from './repositories/projectStorage';
export * from './repositories/rulesetStorage';
export * from './repositories/scratchpadStorage';
export * from './repositories/settingsStorage';
export * from './repositories/stateMutationLedger';
export * from './repositories/worldCanvasStorage';
export * from './repositories/writingStorage';
